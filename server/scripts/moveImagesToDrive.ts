/**
 * Move images kept on the server disk (and product photos stored inline as
 * base64) to Google Drive, and point the database at the Drive links.
 *
 *   npm run images:to-drive              show what would move; nothing changes
 *   npm run images:to-drive -- --apply   move them, then free the disk space
 *
 * Each image is uploaded and saved in the database before its local file is
 * deleted, so a failure part way never loses an image. Running it again only
 * picks up what is left.
 */
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger';
import CompanyLogo from '../models/CompanyLogo';
import Product from '../models/Product';
import Tenant from '../models/Tenant';
import { ImageKind, LEGACY_UPLOADS_DIR, isDataUrlImage, storeDataUrlImage, storeImage } from '../services/imageStorageService';
import { isDriveConfigured } from '../utils/googleDrive';
import { parseArgs, runScript } from './lib/runScript';

const MIME_BY_EXTENSION: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

interface Outcome {
  moved: number;
  missing: string[];
  failed: string[];
}

/** The disk file behind an /uploads/... path, only if it sits inside the uploads folder. */
function localFile(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  const file = path.resolve(LEGACY_UPLOADS_DIR, url.replace(/^\/uploads\//, ''));
  return file.startsWith(LEGACY_UPLOADS_DIR + path.sep) ? file : null;
}

/** Upload one stored image to Drive; returns its link, or null when the file is gone. */
async function toDrive(kind: ImageKind, tenantId: string, stored: string): Promise<{ url: string; file: string | null } | null> {
  if (isDataUrlImage(stored)) return { url: await storeDataUrlImage(kind, tenantId, stored), file: null };

  const file = localFile(stored);
  if (!file) return null;
  const data = await fs.readFile(file).catch(() => null);
  if (!data) return null;

  const mimeType = MIME_BY_EXTENSION[path.extname(file).toLowerCase()] ?? 'image/png';
  return { url: await storeImage(kind, tenantId, { data, mimeType }), file };
}

runScript('moveImagesToDrive', async () => {
  const apply = parseArgs().apply === true;
  if (apply && !isDriveConfigured()) {
    throw new Error('Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN first.');
  }

  const onDiskOrInline = { $regex: '^(/uploads/|data:image/)' };
  const products = await Product.find({ image: onDiskOrInline }).select('_id tenantId name image').lean();
  const tenants = new Map((await Tenant.find().select('_id slug').lean()).map((tenant) => [tenant.slug, tenant._id.toString()]));
  const logos = (await CompanyLogo.find({ url: { $regex: '^/uploads/' } }).lean()).filter((logo) => tenants.has(logo.slug));

  logger.info({ products: products.length, logos: logos.length, apply }, apply ? 'Moving images to Drive' : 'Images still to move (dry run)');
  if (!apply) {
    console.log(`\n${products.length} product images and ${logos.length} logos are not on Drive yet.`);
    console.log('Nothing was changed. To move them, run:\n  npm run images:to-drive -- --apply\n');
    return;
  }

  const outcome: Outcome = { moved: 0, missing: [], failed: [] };

  // One at a time, to stay well inside Drive's rate limits.
  for (const product of products) {
    const label = `product "${product.name}" (${product._id})`;
    try {
      const stored = await toDrive('products', product.tenantId.toString(), product.image as string);
      if (!stored) {
        outcome.missing.push(label);
        continue;
      }
      await Product.updateOne({ _id: product._id }, { $set: { image: stored.url } });
      if (stored.file) await fs.unlink(stored.file).catch(() => undefined);
      outcome.moved += 1;
    } catch (error) {
      outcome.failed.push(`${label}: ${(error as Error).message}`);
    }
  }

  for (const logo of logos) {
    const label = `logo of ${logo.slug}`;
    try {
      const stored = await toDrive('logos', tenants.get(logo.slug)!, logo.url);
      if (!stored) {
        outcome.missing.push(label);
        continue;
      }
      await CompanyLogo.updateOne({ _id: logo._id }, { $set: { url: stored.url, source: 'upload' } });
      if (stored.file) await fs.unlink(stored.file).catch(() => undefined);
      outcome.moved += 1;
    } catch (error) {
      outcome.failed.push(`${label}: ${(error as Error).message}`);
    }
  }

  console.log(`\nMoved ${outcome.moved} images to Google Drive.`);
  if (outcome.missing.length) console.log(`\nFile no longer on disk, left as it was (${outcome.missing.length}):\n  ${outcome.missing.join('\n  ')}`);
  if (outcome.failed.length) console.log(`\nCould not move, run again to retry (${outcome.failed.length}):\n  ${outcome.failed.join('\n  ')}`);
  console.log('');
});

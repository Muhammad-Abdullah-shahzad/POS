/**
 * Product image storage.
 *
 * Files are written under a per-tenant directory so one company's uploads are
 * never mixed with another's, then mirrored to Google Drive in the background:
 * a slow or failing Drive call must never block a sale being set up.
 */
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Request } from 'express';
import { BadRequestError } from '../core/errors';
import { logger } from '../core/logger';
import { deleteFromDrive, extractDriveFileId, uploadToDrive } from '../utils/googleDrive';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'products');
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const ALLOWED_MIME = /^image\/(jpeg|png|webp)$/i;

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    // Scoping by tenant keeps deletes and audits simple, and means a stray
    // filename collision can never overwrite another company's image.
    const tenantDir = path.join(UPLOAD_ROOT, req.user?.tenantId ?? 'unscoped');
    if (!existsSync(tenantDir)) mkdirSync(tenantDir, { recursive: true });
    cb(null, tenantDir);
  },
  filename: (_req, file, cb) => {
    // The random suffix makes the public URL unguessable.
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  },
});

export const productImageUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXTENSIONS.test(file.originalname) && ALLOWED_MIME.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new BadRequestError('Only JPG, PNG and WebP images are allowed'));
  },
});

/** The public URL for a freshly uploaded file. */
export const publicImageUrl = (tenantId: string, file: Express.Multer.File): string =>
  `/uploads/products/${tenantId}/${file.filename}`;

/** Remove a temporary upload after a failed request. Never throws. */
export async function discardUpload(file?: Express.Multer.File): Promise<void> {
  if (!file) return;
  await fs.unlink(file.path).catch(() => undefined);
}

/**
 * Mirror an image to Google Drive and clean up the image it replaced.
 * Deliberately not awaited by callers.
 */
export function mirrorToDrive(productId: string, file: Express.Multer.File, replacedImage?: string | null): void {
  uploadToDrive(file.path, file.filename, file.mimetype)
    .then(() => {
      logger.debug({ productId }, 'Product image mirrored to Drive');
      if (replacedImage) void removeStoredImage(replacedImage);
    })
    .catch((error: Error) => {
      logger.warn({ err: error, productId }, 'Drive mirror failed; local image kept');
    });
}

/** Delete an image from wherever it lives, Drive or local disk. */
export async function removeStoredImage(imageUrl?: string | null): Promise<void> {
  if (!imageUrl) return;

  const driveId = extractDriveFileId(imageUrl);
  if (driveId) {
    await Promise.resolve(deleteFromDrive(driveId)).catch(() => undefined);
    return;
  }

  await fs.unlink(path.join(process.cwd(), imageUrl.replace(/^\//, ''))).catch(() => undefined);
}

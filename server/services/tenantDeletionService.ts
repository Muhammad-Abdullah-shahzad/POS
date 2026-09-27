/**
 * Permanently removing a company: its logins and sessions, every record it
 * owns, its product images and the company itself, licence included.
 *
 * The collections are found rather than listed: any model with a `tenantId`
 * path belongs to a company, so a model added later is removed too without
 * anyone remembering to add it here. The one exception is the logo, which is
 * keyed by the company slug and removed by name below.
 */
import fs from 'fs/promises';
import path from 'path';
import mongoose, { Model, Types } from 'mongoose';
import { withTransaction } from '../config/db';
import { NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import { withSystemScope } from '../core/tenantContext';
import '../models/registry';
import CompanyLogo from '../models/CompanyLogo';
import Product from '../models/Product';
import Tenant from '../models/Tenant';
import { removeStoredImage } from './imageStorageService';
import { isStoredByUs } from './companyLogoService';
import { invalidateTenantCache } from './tenantService';

/** Folders from before images moved to Drive, each holding uploads/<folder>/<tenantId>/. */
const UPLOAD_FOLDERS = ['products', 'logos'].map((folder) => path.join(process.cwd(), 'uploads', folder));

/** Logins go first, so nobody can act for the company while it is removed. */
const DELETE_FIRST = ['Session', 'User'];

export interface CollectionCount {
  collection: string;
  documents: number;
}

function tenantOwnedModels(): Model<any>[] {
  const models = mongoose
    .modelNames()
    .filter((name) => name !== Tenant.modelName)
    .map((name) => mongoose.model(name))
    .filter((model) => Boolean(model.schema.path('tenantId')));

  const rank = (model: Model<any>) => {
    const index = DELETE_FIRST.indexOf(model.modelName);
    return index === -1 ? DELETE_FIRST.length : index;
  };
  return models.sort((a, b) => rank(a) - rank(b));
}

/** What a company owns, per collection. Nothing is changed. */
export async function countTenantData(tenantId: string): Promise<CollectionCount[]> {
  const filter = { tenantId: new Types.ObjectId(tenantId) };

  return withSystemScope(async () => {
    const owned = await Promise.all(
      tenantOwnedModels().map(async (model) => ({
        collection: model.collection.collectionName,
        documents: await model.countDocuments(filter),
      }))
    );
    const tenant = await Tenant.findById(tenantId).select('slug').lean();
    const logos = tenant ? await CompanyLogo.countDocuments({ slug: tenant.slug }) : 0;
    return [...owned, { collection: CompanyLogo.collection.collectionName, documents: logos }];
  });
}

/**
 * Delete the company and everything it owns. The company record goes last,
 * so if anything fails part way the same command can simply be run again.
 */
export async function deleteTenant(tenantId: string): Promise<CollectionCount[]> {
  const filter = { tenantId: new Types.ObjectId(tenantId) };

  return withSystemScope(async () => {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new NotFoundError('Company');

    // Read before the records are gone; the files are removed after the data.
    const images = (await Product.find({ ...filter, image: { $nin: [null, ''] } }).select('image').lean()).map(
      (product) => product.image as string
    );
    const logo = await CompanyLogo.findOne({ slug: tenant.slug }).select('url source').lean();
    if (logo && isStoredByUs(logo)) images.push(logo.url);

    const removed = await withTransaction(async (session) => {
      const counts: CollectionCount[] = [];
      for (const model of tenantOwnedModels()) {
        const result = await model.deleteMany(filter, { session });
        counts.push({ collection: model.collection.collectionName, documents: result.deletedCount ?? 0 });
      }
      const logo = await CompanyLogo.deleteMany({ slug: tenant.slug }, { session });
      counts.push({ collection: CompanyLogo.collection.collectionName, documents: logo.deletedCount ?? 0 });
      await Tenant.deleteOne({ _id: tenant._id }, { session });
      return counts;
    });

    invalidateTenantCache(tenantId);

    // Files are best effort: a missing file must not undo a completed delete.
    await Promise.all(images.map((image) => removeStoredImage(image)));
    for (const folder of UPLOAD_FOLDERS) {
      await fs.rm(path.join(folder, tenantId), { recursive: true, force: true }).catch((error) =>
        logger.warn({ err: error, tenantId, folder }, 'Could not remove a company upload folder')
      );
    }

    logger.info({ tenantId, slug: tenant.slug }, 'Company deleted');
    return removed;
  });
}

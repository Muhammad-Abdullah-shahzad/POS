/**
 * Permanently removing a company: its logins and sessions, every record it
 * owns, its product images and the company itself, licence included.
 *
 * The collections are found rather than listed: any model with a `tenantId`
 * path belongs to a company, so a model added later is removed too without
 * anyone remembering to add it here.
 */
import fs from 'fs/promises';
import path from 'path';
import mongoose, { Model, Types } from 'mongoose';
import { withTransaction } from '../config/db';
import { NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import { withSystemScope } from '../core/tenantContext';
import '../models/registry';
import Product from '../models/Product';
import Tenant from '../models/Tenant';
import { removeStoredImage } from './productImageService';
import { invalidateTenantCache } from './tenantService';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'products');

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

  return withSystemScope(async () =>
    Promise.all(
      tenantOwnedModels().map(async (model) => ({
        collection: model.collection.collectionName,
        documents: await model.countDocuments(filter),
      }))
    )
  );
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

    // Read before the products are gone; the files are removed after the data.
    const images = (await Product.find({ ...filter, image: { $nin: [null, ''] } }).select('image').lean()).map(
      (product) => product.image as string
    );

    const removed = await withTransaction(async (session) => {
      const counts: CollectionCount[] = [];
      for (const model of tenantOwnedModels()) {
        const result = await model.deleteMany(filter, { session });
        counts.push({ collection: model.collection.collectionName, documents: result.deletedCount ?? 0 });
      }
      await Tenant.deleteOne({ _id: tenant._id }, { session });
      return counts;
    });

    invalidateTenantCache(tenantId);

    // Files are best effort: a missing file must not undo a completed delete.
    await Promise.all(images.map((image) => removeStoredImage(image)));
    await fs.rm(path.join(UPLOAD_ROOT, tenantId), { recursive: true, force: true }).catch((error) =>
      logger.warn({ err: error, tenantId }, 'Could not remove the company upload folder')
    );

    logger.info({ tenantId, slug: tenant.slug }, 'Company deleted');
    return removed;
  });
}

/**
 * Index definitions have to be buildable together. The server boots with
 * autoIndex off, so a conflict would otherwise only surface during deployment.
 */
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import '../models/registry';

describe('indexes', () => {
  it('builds every model index without conflicts', async () => {
    for (const modelName of mongoose.modelNames()) {
      await expect(mongoose.model(modelName).syncIndexes(), modelName).resolves.toBeDefined();
    }
  });

  it('scopes unique business keys to the tenant', async () => {
    const productIndexes = await mongoose.model('Product').collection.indexes();
    const uniqueKeys = productIndexes.filter((index) => index.unique).map((index) => Object.keys(index.key));

    expect(uniqueKeys).toContainEqual(['tenantId', 'barcode']);
    expect(uniqueKeys).not.toContainEqual(['barcode']);
  });
});

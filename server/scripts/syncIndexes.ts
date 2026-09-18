/**
 * Build the indexes every model declares.
 *
 * Index creation is switched off at boot (`autoIndex: false`), so this runs as
 * a deliberate step during deployment instead of blocking a starting process.
 */
import mongoose from 'mongoose';
import { logger } from '../core/logger';
import { runScript } from './lib/runScript';

// Importing the model index registers every schema with Mongoose.
import '../models/registry';

runScript('syncIndexes', async () => {
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    await model.syncIndexes();
    logger.info({ model: modelName }, 'Indexes synced');
  }
});

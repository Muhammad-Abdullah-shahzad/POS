/**
 * Sync routes for the Electron desktop till.
 *
 *   POST /api/<collection>/sync         push created and updated records
 *   POST /api/<collection>/sync/delete  push deletions
 *
 * Registered from the collection table so a new synced model needs one entry
 * there and nothing here.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { SYNC_COLLECTIONS, SyncCollection } from '../services/syncService';
import { syncCollection, syncDeletes } from '../controllers/syncController';

const router = Router();

router.use(authenticate);

for (const collection of Object.keys(SYNC_COLLECTIONS) as SyncCollection[]) {
  router.post(`/${collection}/sync`, syncCollection(collection));

  // Settings is a singleton and is never deleted from a till.
  if (collection !== 'settings') {
    router.post(`/${collection}/sync/delete`, syncDeletes(collection));
  }
}

export default router;

/**
 * Sync endpoints used by the Electron desktop till.
 *
 * One pair of handlers serves every collection; the collection itself comes
 * from the route, which keeps this file from growing a near identical block per
 * model.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { BadRequestError } from '../core/errors';
import { SYNC_COLLECTIONS, SyncCollection, deleteRecords, upsertRecords } from '../services/syncService';

export const syncCollection = (collection: SyncCollection) =>
  asyncHandler(async (req: Request, res: Response) => {
    if (!Array.isArray(req.body)) throw new BadRequestError('Expected an array of records');

    const outcome = await upsertRecords(collection, req.body);
    res.json(successResponse(outcome, `Synced ${outcome.upserted} ${SYNC_COLLECTIONS[collection].label}`));
  });

export const syncDeletes = (collection: SyncCollection) =>
  asyncHandler(async (req: Request, res: Response) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) throw new BadRequestError('Expected { ids: string[] }');

    const outcome = await deleteRecords(collection, ids);
    res.json(successResponse(outcome, `Deleted ${outcome.deleted} ${SYNC_COLLECTIONS[collection].label}`));
  });

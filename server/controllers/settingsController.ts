/**
 * Shop settings — one document per company, created on demand so a tenant that
 * predates a settings field still gets sensible defaults.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import Settings, { ISettings, IQuickProduct } from '../models/Settings';

/** Fields a client may never overwrite through the settings endpoint. */
const PROTECTED_FIELDS = ['_id', 'tenantId', 'createdAt', 'updatedAt'];

async function loadSettings(): Promise<ISettings> {
  const existing = await Settings.findOne();
  if (existing) return existing;

  return Settings.create({});
}

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  res.json(successResponse(await loadSettings()));
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await loadSettings();

  const update = { ...req.body };
  for (const field of PROTECTED_FIELDS) delete update[field];

  const updated = await Settings.findByIdAndUpdate(
    settings._id,
    { $set: update },
    { returnDocument: 'after', runValidators: true }
  );

  res.json(successResponse(updated, 'Settings updated'));
});

export const getQuickProducts = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json(successResponse(settings.quickProducts ?? []));
});

export const updateQuickProducts = asyncHandler(async (req: Request, res: Response) => {
  const quickProducts: IQuickProduct[] = (req.body.quickProducts as IQuickProduct[]).map((item) => ({
    id: item.id || `quick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name.trim().toUpperCase(),
    barcode: item.barcode.trim(),
    color: item.color.trim(),
  }));

  const settings = await loadSettings();
  const updated = await Settings.findByIdAndUpdate(
    settings._id,
    { $set: { quickProducts } },
    { returnDocument: 'after', runValidators: true }
  );

  res.json(successResponse(updated?.quickProducts ?? [], 'Quick products updated'));
});

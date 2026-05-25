import { Request, Response } from 'express';
import Settings from '../models/Settings';
import { successResponse, errorResponse } from '../utils/response';

const ensureSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
};

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ensureSettings();
    res.json(successResponse(settings));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      settings = await Settings.findByIdAndUpdate(settings._id, req.body, {
        new: true,
        runValidators: true,
      });
    }
    res.json(successResponse(settings, 'Settings updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const getQuickProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ensureSettings();
    res.json(successResponse(settings.quickProducts || []));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const updateQuickProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const quickProducts = Array.isArray(req.body.quickProducts) ? req.body.quickProducts : [];
    const cleanedQuickProducts = quickProducts
      .filter((item: any) => item?.name && item?.barcode && item?.color)
      .map((item: any) => ({
        id: String(item.id || `quick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        name: String(item.name).trim().toUpperCase(),
        barcode: String(item.barcode).trim(),
        color: String(item.color).trim(),
      }));

    const settings = await ensureSettings();
    const updatedSettings = await Settings.findByIdAndUpdate(
      settings._id,
      { quickProducts: cleanedQuickProducts },
      { new: true, runValidators: true }
    );

    res.json(successResponse(updatedSettings?.quickProducts || [], 'Quick products updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const getExpenseCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ensureSettings();
    res.json(successResponse(settings.expenseCategories || []));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const updateExpenseCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = Array.isArray(req.body.expenseCategories)
      ? req.body.expenseCategories.map((c: any) => String(c).trim()).filter(Boolean)
      : [];

    const settings = await ensureSettings();
    const updated = await Settings.findByIdAndUpdate(
      settings._id,
      { expenseCategories: categories },
      { new: true }
    );
    res.json(successResponse(updated?.expenseCategories || [], 'Expense categories updated'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

import { Request, Response } from 'express';
import Supplier from '../models/Supplier';
import { successResponse, errorResponse } from '../utils/response';

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const query = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const suppliers = await Supplier.find(query).sort({ createdAt: -1 });
    res.json(successResponse(suppliers));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(successResponse(supplier, 'Supplier created'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

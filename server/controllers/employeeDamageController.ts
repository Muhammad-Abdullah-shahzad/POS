import { Request, Response } from 'express';
import EmployeeDamage from '../models/EmployeeDamage';
import { successResponse, errorResponse } from '../utils/response';

export const getEmployeeDamages = async (req: Request, res: Response): Promise<void> => {
  try {
    const damages = await EmployeeDamage.find().sort({ date: -1 });
    res.json(successResponse(damages));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createEmployeeDamage = async (req: Request, res: Response): Promise<void> => {
  try {
    const damage = await EmployeeDamage.create(req.body);
    res.status(201).json(successResponse(damage, 'Damage record created'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const updateEmployeeDamage = async (req: Request, res: Response): Promise<void> => {
  try {
    const damage = await EmployeeDamage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(successResponse(damage, 'Damage record updated'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const deleteEmployeeDamage = async (req: Request, res: Response): Promise<void> => {
  try {
    await EmployeeDamage.findByIdAndDelete(req.params.id);
    res.json(successResponse(null, 'Damage record deleted'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

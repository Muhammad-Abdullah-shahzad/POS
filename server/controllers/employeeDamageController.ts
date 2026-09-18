import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import EmployeeDamage from '../models/EmployeeDamage';

export const getEmployeeDamages = asyncHandler(async (_req: Request, res: Response) => {
  const damages = await EmployeeDamage.find().sort({ date: -1 });
  res.json(successResponse(damages));
});

export const createEmployeeDamage = asyncHandler(async (req: Request, res: Response) => {
  const damage = await EmployeeDamage.create(req.body);
  res.status(201).json(successResponse(damage, 'Damage record created'));
});

export const updateEmployeeDamage = asyncHandler(async (req: Request, res: Response) => {
  const damage = await EmployeeDamage.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!damage) throw new NotFoundError('Damage record');

  res.json(successResponse(damage, 'Damage record updated'));
});

export const deleteEmployeeDamage = asyncHandler(async (req: Request, res: Response) => {
  const damage = await EmployeeDamage.findByIdAndDelete(req.params.id);
  if (!damage) throw new NotFoundError('Damage record');

  res.json(successResponse(null, 'Damage record deleted'));
});

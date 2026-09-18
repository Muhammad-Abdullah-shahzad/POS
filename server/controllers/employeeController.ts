import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import Employee from '../models/Employee';

export const getEmployees = asyncHandler(async (_req: Request, res: Response) => {
  const employees = await Employee.find().sort({ createdAt: -1 });
  res.json(successResponse(employees));
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await Employee.create(req.body);
  res.status(201).json(successResponse(employee, 'Employee created'));
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!employee) throw new NotFoundError('Employee');

  res.json(successResponse(employee, 'Employee updated'));
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) throw new NotFoundError('Employee');

  res.json(successResponse(null, 'Employee deleted'));
});

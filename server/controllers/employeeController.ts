import { Request, Response } from 'express';
import Employee from '../models/Employee';
import { successResponse, errorResponse } from '../utils/response';

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(successResponse(employees));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json(successResponse(employee, 'Employee created'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

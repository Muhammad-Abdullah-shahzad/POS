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

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!employee) {
      res.status(404).json(errorResponse('Not Found', 'Employee not found'));
      return;
    }
    res.json(successResponse(employee, 'Employee updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id);
    if (!employee) {
      res.status(404).json(errorResponse('Not Found', 'Employee not found'));
      return;
    }
    res.json(successResponse(null, 'Employee deleted successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

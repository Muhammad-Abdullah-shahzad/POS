import { Request, Response } from 'express';
import Customer from '../models/Customer';
import { successResponse, errorResponse } from '../utils/response';

// Get all customers, with optional search
export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const query = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { contactNum1: { $regex: search, $options: 'i' } },
        { contactNum2: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { eircode: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(successResponse(customers));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

// Create a new customer
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(successResponse(customer, 'Customer created successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

// Update general customer fields
export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!customer) {
      res.status(404).json(errorResponse('Customer not found'));
      return;
    }
    res.json(successResponse(customer, 'Customer updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

// Delete a customer
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      res.status(404).json(errorResponse('Customer not found'));
      return;
    }
    res.json(successResponse(null, 'Customer deleted successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

// Record a transaction for a customer (increment visits, add totalAmount, set lastVisit)
export const updateCustomerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number') {
      res.status(400).json(errorResponse('Amount must be a number'));
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { 
        $inc: { timesVisited: 1, totalAmount: amount },
        $set: { lastVisit: today }
      },
      { new: true }
    );
    
    if (!customer) {
      res.status(404).json(errorResponse('Customer not found'));
      return;
    }
    
    res.json(successResponse(customer, 'Customer stats updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

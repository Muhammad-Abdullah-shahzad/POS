/**
 * Customer records and the loyalty balance attached to them.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import Customer from '../models/Customer';
import Settings from '../models/Settings';
import { searchFilter } from '../utils/query';

const SEARCHABLE_FIELDS = ['name', 'contactNum1', 'contactNum2', 'email', 'eircode'];

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const search = req.validatedQuery?.search as string | undefined;
  const customers = await Customer.find(searchFilter(search, SEARCHABLE_FIELDS)).sort({ name: 1 });

  res.json(successResponse(customers));
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.create(req.body);
  res.status(201).json(successResponse(customer, 'Customer created'));
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!customer) throw new NotFoundError('Customer');

  res.json(successResponse(customer, 'Customer updated'));
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  res.json(successResponse(null, 'Customer deleted'));
});

/**
 * Record a sale against a customer: one more visit, a larger lifetime total and
 * the loyalty points it earned.
 */
export const recordCustomerTransaction = asyncHandler(async (req: Request, res: Response) => {
  const { amount, pointsOverride } = req.body as { amount: number; pointsOverride?: number };

  // A category specific rule wins; otherwise the company's global rate applies.
  let pointsEarned: number;
  if (typeof pointsOverride === 'number') {
    pointsEarned = Math.floor(pointsOverride);
  } else {
    const settings = await Settings.findOne().select('loyaltyPointsPerEuro').lean();
    pointsEarned = Math.floor(amount * (settings?.loyaltyPointsPerEuro ?? 1));
  }

  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    {
      $inc: { timesVisited: 1, totalAmount: amount, loyaltyPoints: pointsEarned },
      $set: { lastVisit: new Date().toISOString().slice(0, 10) },
    },
    { returnDocument: 'after' }
  );
  if (!customer) throw new NotFoundError('Customer');

  res.json(successResponse({ ...customer.toObject(), pointsEarned }, 'Customer updated'));
});

export const resetLoyaltyPoints = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { $set: { loyaltyPoints: 0 } },
    { returnDocument: 'after' }
  );
  if (!customer) throw new NotFoundError('Customer');

  res.json(successResponse(customer, 'Loyalty points reset'));
});

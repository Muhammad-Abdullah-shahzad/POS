/**
 * Customer records and the loyalty balance attached to them.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import Customer from '../models/Customer';
import CustomerPayment from '../models/CustomerPayment';
import Order from '../models/Order';
import Settings from '../models/Settings';
import { searchFilter } from '../utils/query';

const SEARCHABLE_FIELDS = ['name', 'contactNum1', 'contactNum2', 'email', 'eircode'];

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const search = req.validatedQuery?.search as string | undefined;
  const customers = await Customer.find(searchFilter(search, SEARCHABLE_FIELDS)).sort({ name: 1 });

  res.json(successResponse(customers));
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  // If an openingBalance is provided, initialise outstandingBalance to match
  const body = { ...req.body };
  if (body.openingBalance && !body.outstandingBalance) {
    body.outstandingBalance = body.openingBalance;
  }
  const customer = await Customer.create(body);
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

/**
 * Return the full credit ledger for a customer: all their orders plus all
 * manual payments they have made against their outstanding balance.
 */
export const getLedger = asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);

  const [orders, payments, customer] = await Promise.all([
    Order.find({ customerId, status: { $ne: 'voided' } }).sort({ createdAt: -1 }).lean(),
    CustomerPayment.find({ customerId }).sort({ createdAt: -1 }).lean(),
    Customer.findById(customerId).lean(),
  ]);

  res.json(successResponse({ orders, payments, customer }));
});

/**
 * Record a manual payment from a customer to reduce their outstanding balance.
 */
export const addPayment = asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const { amountPaid, paymentMethod, customerName, notes } = req.body as {
    amountPaid: number;
    paymentMethod: string;
    customerName?: string;
    notes?: string;
  };

  const customer = await Customer.findById(customerId);
  if (!customer) throw new NotFoundError('Customer');

  const payment = await CustomerPayment.create({
    customerId,
    customerName: customerName || customer.name,
    amountPaid,
    paymentMethod,
    date: new Date().toISOString().split('T')[0],
    notes: notes || '',
  });

  // Reduce outstanding balance
  const updatedCustomer = await Customer.findByIdAndUpdate(
    customerId,
    { $inc: { outstandingBalance: -amountPaid } },
    { new: true }
  );

  res.status(201).json(successResponse({ payment, customer: updatedCustomer }, 'Payment recorded'));
});


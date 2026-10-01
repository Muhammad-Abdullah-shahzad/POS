/**
 * Customer records and the loyalty balance attached to them.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { BadRequestError, ConflictError, NotFoundError } from '../core/errors';
import Customer from '../models/Customer';
import * as ledger from '../services/customerLedgerService';
import CustomerPayment from '../models/CustomerPayment';
import Order from '../models/Order';
import ProductReturn from '../models/ProductReturn';
import Settings from '../models/Settings';
import { sameValueFilter, searchFilter } from '../utils/query';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const SEARCHABLE_FIELDS = ['name', 'contactNum1', 'contactNum2', 'email', 'eircode'];

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const search = req.validatedQuery?.search as string | undefined;
  const customers = await Customer.find(searchFilter(search, SEARCHABLE_FIELDS)).sort({ name: 1 });

  res.json(successResponse(customers));
});

/** Customer names are unique, so a name always points to one account. */
async function assertNameFree(name: unknown, exceptId?: string): Promise<void> {
  if (typeof name !== 'string' || !name.trim()) return;
  const taken = await Customer.findOne({
    ...sameValueFilter('name', name),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).select('name');
  if (taken) throw new ConflictError(`A customer named "${taken.name}" already exists`);
}

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  await assertNameFree(req.body.name);
  // If an openingBalance is provided, initialise outstandingBalance to match
  const body = { ...req.body };
  if (body.openingBalance && !body.outstandingBalance) {
    body.outstandingBalance = body.openingBalance;
  }
  const customer = await Customer.create(body);
  res.status(201).json(successResponse(customer, 'Customer created'));
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  await assertNameFree(req.body.name, customerId);

  // A new opening balance moves what the customer owes by the same amount.
  const { openingBalance, ...details } = req.body as { openingBalance?: number } & Record<string, unknown>;
  if (openingBalance !== undefined) await ledger.setOpeningBalance(customerId, openingBalance);

  const customer = await Customer.findByIdAndUpdate(customerId, details, {
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

  const [orders, payments, returns, customer] = await Promise.all([
    Order.find({ customerId, status: { $ne: 'voided' } }).sort({ createdAt: -1 }).lean(),
    CustomerPayment.find({ customerId }).sort({ createdAt: -1 }).lean(),
    ProductReturn.find({ customerId }).sort({ createdAt: -1 }).lean(),
    Customer.findById(customerId).lean(),
  ]);

  res.json(successResponse({ orders, payments, returns, customer }));
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

  const owed = customer.outstandingBalance || 0;
  if (amountPaid > owed + ROUNDING_TOLERANCE) {
    throw new BadRequestError(`${customer.name} owes ${owed.toFixed(2)}; a payment cannot be more than that`);
  }

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


/** Correct a recorded payment: its amount, method or notes. */
export const updateCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const outcome = await ledger.updatePayment(String(req.params.id), String(req.params.entryId), req.body);
  res.json(successResponse(outcome, 'Payment updated'));
});

/** Correct how much of a sale went on the customer's account, or its remarks. */
export const updateCustomerSale = asyncHandler(async (req: Request, res: Response) => {
  const outcome = await ledger.updateSale(String(req.params.id), String(req.params.entryId), req.body);
  res.json(successResponse(outcome, 'Sale updated'));
});

/** Delete a recorded payment; the customer owes that amount again. */
export const deleteCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const customer = await ledger.deletePayment(String(req.params.id), String(req.params.entryId));
  res.json(successResponse({ customer }, 'Payment deleted'));
});

/** Change the opening balance; what the customer owes moves by the same amount. */
export const updateOpeningBalance = asyncHandler(async (req: Request, res: Response) => {
  const customer = await ledger.setOpeningBalance(String(req.params.id), req.body.openingBalance);
  res.json(successResponse({ customer }, 'Opening balance updated'));
});

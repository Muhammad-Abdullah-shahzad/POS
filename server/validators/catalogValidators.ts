/**
 * Schemas for the smaller reference collections: categories, customers,
 * employees, wastage, suppliers and their invoices, expenses and banking
 * details.
 */
import { z } from 'zod';
import { email, nonEmptyString, objectId, optionalString, positiveNumber } from './common';
import { WASTAGE_REASONS } from '../models/WastageEntry';

// ── Categories ──────────────────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: nonEmptyString('Category name', 80),
  items: z.array(z.string().trim()).default([]),
  vatRate: positiveNumber('VAT rate').default(0),
  vatType: z.enum(['inclusive', 'exclusive']).default('exclusive'),
});

export const updateCategorySchema = createCategorySchema.partial();

// ── Customers ───────────────────────────────────────────────────────────────
export const createCustomerSchema = z.object({
  name: nonEmptyString('Customer name', 160),
  contactNum1: nonEmptyString('Contact number', 40),
  contactNum2: optionalString(40),
  email: email.optional().or(z.literal('')),
  address: optionalString(300),
  eircode: optionalString(20),
  qrCode: optionalString(200),
  barcode: optionalString(80),
  birthday: z.coerce.date().nullish(),
  anniversary: z.coerce.date().nullish(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  loyaltyPoints: z.coerce.number().min(0).optional(),
});

export const customerTransactionSchema = z.object({
  amount: z.coerce.number({ message: 'Amount must be a number' }),
  pointsOverride: z.coerce.number().min(0).optional(),
});

// ── Employees ───────────────────────────────────────────────────────────────
export const createEmployeeSchema = z.object({
  name: nonEmptyString('Name', 160),
  contactNo: nonEmptyString('Contact number', 40),
  emailId: email,
  address: nonEmptyString('Address', 300),
  role: nonEmptyString('Role', 60),
  gender: nonEmptyString('Gender', 30),
  dob: z.coerce.date({ message: 'Date of birth is required' }),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const createEmployeeDamageSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required'),
  employeeName: nonEmptyString('Employee name', 160),
  item: nonEmptyString('Item', 160),
  value: positiveNumber('Value').default(0),
  deduction: positiveNumber('Deduction').default(0),
  status: z.enum(['Pending Approval', 'Deducted', 'Resolved']).default('Pending Approval'),
  date: nonEmptyString('Date', 40),
});

export const updateEmployeeDamageSchema = createEmployeeDamageSchema.partial();

// ── Wastage ─────────────────────────────────────────────────────────────────
export const recordWastageSchema = z.object({
  productId: objectId,
  quantity: z.coerce.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1'),
  reason: z.enum(WASTAGE_REASONS),
});

export type RecordWastageInput = z.infer<typeof recordWastageSchema>;

// ── Supplier invoices ───────────────────────────────────────────────────────
export const createSupplierInvoiceSchema = z
  .object({
    supplierId: objectId.optional(),
    supplierName: nonEmptyString('Supplier', 160),
    invoiceNo: nonEmptyString('Invoice number', 80),
    amount: positiveNumber('Amount'),
    paid: positiveNumber('Paid').default(0),
    date: z.coerce.date({ message: 'A valid date is required' }),
  })
  .refine((invoice) => invoice.paid <= invoice.amount, { message: 'Paid cannot be more than the invoice amount', path: ['paid'] });

export const supplierPaymentSchema = z.object({
  amount: z.coerce.number({ message: 'Amount must be a number' }).positive('Amount must be more than zero'),
});

// ── Suppliers ───────────────────────────────────────────────────────────────
export const createSupplierSchema = z.object({
  name: nonEmptyString('Name', 160),
  contact: nonEmptyString('Contact', 40),
  emailId: email,
  address: nonEmptyString('Address', 300),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ── Expenses ────────────────────────────────────────────────────────────────
export const createExpenseSchema = z.object({
  title: nonEmptyString('Title', 160),
  amount: positiveNumber('Amount'),
  category: nonEmptyString('Category', 80),
  date: z.coerce.date().default(() => new Date()),
  paymentMethod: nonEmptyString('Payment method', 40),
  notes: optionalString(500),
  attachmentUrl: optionalString(500),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseCategorySchema = z.object({ name: nonEmptyString('Category name', 80) });

// ── Banking ─────────────────────────────────────────────────────────────────
export const bankNameSchema = z.object({ name: nonEmptyString('Bank name', 120) });

export const bankAccountSchema = z.object({
  bankName: nonEmptyString('Bank name', 120),
  type: nonEmptyString('Account type', 60),
  accountName: nonEmptyString('Account name', 160),
  iban: nonEmptyString('IBAN', 60),
  bic: nonEmptyString('BIC', 20),
});

export const bankCardSchema = z.object({
  bankName: nonEmptyString('Bank name', 120),
  accountName: nonEmptyString('Account name', 160),
  type: nonEmptyString('Card type', 60),
  cardNumber: nonEmptyString('Card number', 30),
  cardName: nonEmptyString('Card name', 160),
  expiryDate: nonEmptyString('Expiry date', 10),
});

// ── Settings ────────────────────────────────────────────────────────────────
export const updateSettingsSchema = z
  .object({
    shopName: nonEmptyString('Shop name', 160).optional(),
    shopAddress: optionalString(300),
    shopPhone: optionalString(40),
    shopEmail: z.string().trim().max(160).optional(),
    shopWebsite: optionalString(160),
    receiptFooter: optionalString(500),
    defaultVatRate: positiveNumber('VAT rate').optional(),
    isVatInclusiveDefault: z.coerce.boolean().optional(),
    loyaltyPointsPerEuro: positiveNumber('Points per euro').optional(),
    loyaltyRewardThreshold: positiveNumber('Reward threshold').optional(),
    loyaltyRewardValue: positiveNumber('Reward value').optional(),
    expenseCategories: z.array(z.string().trim().min(1)).optional(),
  })
  .passthrough();

export const quickProductsSchema = z.object({
  quickProducts: z
    .array(
      z.object({
        id: z.string().trim().optional(),
        name: nonEmptyString('Name', 60),
        barcode: nonEmptyString('Barcode', 60),
        color: nonEmptyString('Colour', 20),
      })
    )
    .max(24, 'At most 24 quick buttons are supported'),
});

// ── Shared query shapes ─────────────────────────────────────────────────────
export const searchQuery = z.object({ search: z.string().trim().max(120).optional() });

export const dashboardQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be formatted as YYYY-MM')
    .optional(),
});

export const analyticsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  months: z.coerce.number().int().min(1).max(36).default(6),
});

export const customerIdParam = z.object({ id: objectId });

import { z } from 'zod';
import { nonEmptyString, positiveNumber } from './common';

/**
 * Products are submitted as multipart form data when an image is attached, so
 * every numeric field arrives as a string and has to be coerced.
 */
const productFields = {
  name: nonEmptyString('Name', 160),
  sku: z.string().trim().max(60).optional(),
  barcode: nonEmptyString('Barcode', 60),
  category: nonEmptyString('Category', 80),
  price: positiveNumber('Price'),
  costPrice: positiveNumber('Cost price'),
  vatRate: positiveNumber('VAT rate'),
  vatType: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  stock: z.coerce.number().int('Stock must be a whole number').default(0),
  drs: positiveNumber('DRS').default(0),
};

export const createProductSchema = z.object({
  ...productFields,
  price: productFields.price.default(0),
  costPrice: productFields.costPrice.default(0),
  vatRate: productFields.vatRate.default(0),
});

export const updateProductSchema = z
  .object(productFields)
  .partial()
  // An empty SKU means "no SKU", not "set the SKU to an empty string".
  .transform(({ sku, ...rest }) => (sku ? { ...rest, sku } : rest));

export const stockAdjustmentSchema = z.object({
  quantity: z.coerce
    .number({ message: 'Quantity must be a number' })
    .refine((value) => value !== 0, 'Quantity must not be zero'),
});

export const productSearchQuery = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const barcodeParam = z.object({
  barcode: nonEmptyString('Barcode', 60),
});

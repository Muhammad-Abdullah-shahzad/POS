import { Types } from 'mongoose';
import { z } from 'zod';

export const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), { message: 'Must be a valid identifier' });

export const idParam = z.object({ id: objectId });

export const nonEmptyString = (field: string, max = 200) =>
  z.string().trim().min(1, `${field} is required`).max(max, `${field} is too long`);

export const optionalString = (max = 500) => z.string().trim().max(max).optional();

export const email = z.string().trim().toLowerCase().email('A valid email address is required');

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const positiveNumber = (field: string) =>
  z.coerce.number({ message: `${field} must be a number` }).min(0, `${field} cannot be negative`);

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().trim().max(120).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

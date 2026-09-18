import { z } from 'zod';
import { optionalString } from './common';

/** A pasted key. Whitespace from copy and paste is stripped before verification. */
export const activateLicenseSchema = z.object({
  key: z.string().trim().min(20, 'Enter the full licence key').max(2000, 'That does not look like a licence key'),
});

/** Operator request to issue or extend a licence. */
export const issueLicenseSchema = z
  .object({
    months: z.coerce.number().int().min(0).max(36).default(1),
    days: z.coerce.number().int().min(0).max(3660).default(0),
    kind: z.enum(['paid', 'trial']).default('paid'),
    note: optionalString(300),
    /** Start from today instead of adding to the current expiry. */
    fromNow: z.boolean().default(false),
  })
  .refine((term) => term.months > 0 || term.days > 0, {
    message: 'The term must be at least one day',
    path: ['months'],
  });

export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;
export type IssueLicenseInput = z.infer<typeof issueLicenseSchema>;

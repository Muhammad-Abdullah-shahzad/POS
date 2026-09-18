import { z } from 'zod';
import { email, nonEmptyString, password } from './common';
import { issueLicenseSchema } from './licenseValidators';

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

/** Public sign up: one form creates the company and its first admin. */
export const registerSchema = z.object({
  companyName: nonEmptyString('Company name', 120),
  name: nonEmptyString('Your name', 120),
  email,
  password,
  phone: z.string().trim().max(40).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

export const createUserSchema = z.object({
  name: nonEmptyString('Name', 120),
  email,
  password,
  // A company runs its till with admins, managers and cashiers; platform level
  // access is never granted through this endpoint.
  role: z.enum(['admin', 'manager', 'cashier']).default('cashier'),
});

export const updateUserSchema = z.object({
  name: nonEmptyString('Name', 120).optional(),
  role: z.enum(['admin', 'manager', 'cashier']).optional(),
  isActive: z.boolean().optional(),
  password: password.optional(),
});

export const provisionTenantSchema = z.object({
  company: z.object({
    name: nonEmptyString('Company name', 120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Slug may contain lowercase letters, digits and hyphens')
      .optional(),
    contactEmail: email,
    contactPhone: z.string().trim().max(40).optional(),
    plan: z.string().trim().max(40).optional(),
  }),
  admin: z.object({
    name: nonEmptyString('Admin name', 120),
    email,
    password,
  }),
  // Omit for the configured trial, send null to onboard locked, or give a term.
  license: issueLicenseSchema.nullable().optional(),
});

export const tenantStatusSchema = z.object({
  status: z.enum(['active', 'trial', 'suspended', 'cancelled']),
  reason: z.string().trim().max(300).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ProvisionTenantInput = z.infer<typeof provisionTenantSchema>;

/**
 * Platform administration — onboarding, account status and licences.
 *
 * These endpoints sit outside every tenant and are guarded by a server side
 * key, never by a user token. They are the HTTP face of the manual billing
 * process: a customer pays, the operator issues or extends their licence and
 * sends them the key.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { ITenant } from '../models/Tenant';
import { describeLicense, getLicenseStatus, issueLicense } from '../services/licenseService';
import * as tenantService from '../services/tenantService';

/** The operator's view of a company: identity, standing and licence. */
const toTenantSummary = (tenant: ITenant) => ({
  id: tenant._id.toString(),
  name: tenant.name,
  slug: tenant.slug,
  status: tenant.status,
  statusReason: tenant.statusReason,
  plan: tenant.plan,
  contactEmail: tenant.contactEmail,
  contactPhone: tenant.contactPhone,
  createdAt: tenant.createdAt,
  license: describeLicense(tenant.license),
});

export const provisionTenant = asyncHandler(async (req: Request, res: Response) => {
  const { tenant, admin } = await tenantService.provisionTenant(req.body);

  res.status(201).json(
    successResponse(
      {
        tenant: toTenantSummary(tenant),
        admin: {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
      `${tenant.name} is ready. The admin can sign in with ${admin.email}.`
    )
  );
});

export const listTenants = asyncHandler(async (_req: Request, res: Response) => {
  const tenants = await tenantService.listTenants();
  res.json(successResponse(tenants.map(toTenantSummary)));
});

export const updateTenantStatus = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await tenantService.setTenantStatus(String(req.params.id), req.body.status, req.body.reason);
  res.json(successResponse(toTenantSummary(tenant), `Company status set to ${tenant.status}`));
});

export const getTenantLicense = asyncHandler(async (req: Request, res: Response) => {
  res.json(successResponse(await getLicenseStatus(String(req.params.id))));
});

/**
 * Issue or extend a licence. The response carries the key to send to the
 * customer; the company is unlocked on the server the moment this returns.
 */
export const issueTenantLicense = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await issueLicense(String(req.params.id), req.body);
  const license = describeLicense(tenant.license);

  res.status(201).json(
    successResponse(
      { tenant: toTenantSummary(tenant), license },
      `Licence for ${tenant.name} now runs until ${license.expiresAt?.slice(0, 10)}`
    )
  );
});

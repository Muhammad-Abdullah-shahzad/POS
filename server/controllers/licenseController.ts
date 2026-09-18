/**
 * The company's own view of its licence: read the status, paste in a key.
 *
 * Both endpoints stay reachable after the licence has run out, otherwise a
 * customer could never renew from inside the app.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { UnauthorizedError } from '../core/errors';
import { activateLicenseKey, getLicenseStatus } from '../services/licenseService';

export const getLicense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();

  res.json(successResponse(await getLicenseStatus(req.user.tenantId)));
});

export const activateLicense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();

  const status = await activateLicenseKey(req.user.tenantId, req.body.key);
  res.json(successResponse(status, status.state === 'active' ? 'Licence activated' : status.message));
});

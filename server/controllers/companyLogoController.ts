import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { BadRequestError, UnauthorizedError } from '../core/errors';
import type { ICompanyLogo } from '../models/CompanyLogo';
import { getLogoForTenant, removeLogoForTenant, uploadLogoForTenant } from '../services/companyLogoService';

const toResponse = (logo: ICompanyLogo | null) =>
  logo ? { _id: logo._id, slug: logo.slug, url: logo.url, updatedAt: logo.updatedAt } : null;

/** GET /api/company-logo: the signed-in company's logo, or null. */
export const getCompanyLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(successResponse(toResponse(await getLogoForTenant(req.user.tenantId))));
});

/** POST /api/company-logo: upload a new logo (field "logo"), replacing the old one. */
export const uploadCompanyLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  if (!req.file) throw new BadRequestError('Choose an image to upload');

  const logo = await uploadLogoForTenant(req.user.tenantId, req.file);
  res.status(201).json(successResponse(toResponse(logo), 'Logo updated'));
});

/** DELETE /api/company-logo: remove the logo. */
export const deleteCompanyLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await removeLogoForTenant(req.user.tenantId);
  res.json(successResponse(null, 'Logo removed'));
});

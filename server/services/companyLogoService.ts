/**
 * Company logos: one per company, stored as (slug, url).
 */
import { BadRequestError, NotFoundError } from '../core/errors';
import CompanyLogo, { ICompanyLogo } from '../models/CompanyLogo';
import Tenant from '../models/Tenant';
import { imageUpload, removeStoredImage, storeUploadedImage } from './imageStorageService';

/** A logo is small; 5 MB is plenty and keeps invoices quick to print. */
export const logoImageUpload = imageUpload(5 * 1024 * 1024);

/** Only absolute web addresses, so a logo always loads the same on web and desktop. */
export function assertLogoUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new BadRequestError('The logo URL is not a valid web address');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestError('The logo URL must start with https:// or http://');
  }
  return parsed.toString();
}

/** Link a logo hosted elsewhere (the operator's `npm run logo:set`). */
export async function setCompanyLogo(slug: string, url: string): Promise<ICompanyLogo> {
  const address = assertLogoUrl(url);
  const key = slug.toLowerCase();
  const previous = await CompanyLogo.findOne({ slug: key }).select('url source').lean();

  const logo = (await CompanyLogo.findOneAndUpdate(
    { slug: key },
    { $set: { url: address, source: 'link' } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  )) as ICompanyLogo;

  // Linking a logo replaces an uploaded one, whose file is no longer needed.
  if (previous && isStoredByUs(previous)) await removeStoredImage(previous.url);
  return logo;
}

export async function removeCompanyLogo(slug: string): Promise<boolean> {
  const logo = await CompanyLogo.findOneAndDelete({ slug: slug.toLowerCase() });
  if (!logo) return false;
  if (isStoredByUs(logo)) await removeStoredImage(logo.url);
  return true;
}

/** The logo of the company a signed-in user belongs to, if it has one. */
export async function getLogoForTenant(tenantId: string): Promise<ICompanyLogo | null> {
  const tenant = await Tenant.findById(tenantId).select('slug').lean();
  if (!tenant) return null;
  return CompanyLogo.findOne({ slug: tenant.slug });
}

/**
 * Only logos we stored are ever deleted: uploads, and older ones kept on the
 * server disk. A logo the operator linked is someone else's file.
 */
export const isStoredByUs = (logo: { url: string; source?: string }): boolean =>
  logo.source === 'upload' || logo.url.startsWith('/uploads/');

async function slugOf(tenantId: string): Promise<string> {
  const tenant = await Tenant.findById(tenantId).select('slug').lean();
  if (!tenant) throw new NotFoundError('Company');
  return tenant.slug;
}

/**
 * Store a logo the company's admin uploaded on Google Drive, replacing any
 * earlier one. The previous file is deleted so Drive does not fill up.
 */
export async function uploadLogoForTenant(tenantId: string, file: Express.Multer.File): Promise<ICompanyLogo> {
  const slug = await slugOf(tenantId);
  const previous = await CompanyLogo.findOne({ slug }).select('url source').lean();
  const url = await storeUploadedImage('logos', tenantId, file);

  let logo: ICompanyLogo;
  try {
    logo = (await CompanyLogo.findOneAndUpdate(
      { slug },
      { $set: { url, source: 'upload' } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    )) as ICompanyLogo;
  } catch (error) {
    // The new file is only useful if the logo record points at it.
    await removeStoredImage(url);
    throw error;
  }

  if (previous && previous.url !== url && isStoredByUs(previous)) await removeStoredImage(previous.url);
  return logo;
}

/** Remove the company's logo, and its file when we stored it. */
export async function removeLogoForTenant(tenantId: string): Promise<boolean> {
  return removeCompanyLogo(await slugOf(tenantId));
}

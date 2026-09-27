/**
 * The company logo on the desktop till: a read-only copy of the server's,
 * refreshed by sync. The till belongs to one company, so there is at most one.
 */
import { handleLicensed } from '../license/licenseGuard';
import { dbGet } from '../db/database';

export function registerCompanyLogoHandlers(): void {
  handleLicensed('companyLogo:get', () => {
    return dbGet('SELECT _id, slug, url, updatedAt FROM company_logos ORDER BY updatedAt DESC LIMIT 1');
  });
}

/**
 * Set or remove a company's logo.
 *
 *   npm run logo:set -- --tenant corner-shop --url https://example.com/logo.png
 *   npm run logo:set -- --tenant corner-shop --remove
 *
 * The logo shows on the company's A4 invoices, till receipts and sidebar.
 * Web users see it on their next page load; desktop tills at their next sync.
 */
import { logger } from '../core/logger';
import { removeCompanyLogo, setCompanyLogo } from '../services/companyLogoService';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

runScript('setCompanyLogo', async () => {
  const args = parseArgs();
  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));

  if (args.remove === true) {
    const removed = await removeCompanyLogo(tenant.slug);
    logger.info({ slug: tenant.slug, removed }, removed ? 'Logo removed' : 'The company had no logo');
    return;
  }

  const logo = await setCompanyLogo(tenant.slug, requireArg(args, 'url'));
  logger.info({ slug: logo.slug, url: logo.url }, 'Logo set');
});

/**
 * List every company with its standing and licence, oldest first.
 *
 *   npm run tenant:list
 *   npm run tenant:list -- --expiring 7     only licences ending within 7 days (or already ended)
 *
 * This is the operator's monthly billing view: who is due, who has lapsed.
 */
import { describeLicense } from '../services/licenseService';
import { listTenants } from '../services/tenantService';
import { parseArgs, runScript } from './lib/runScript';

const pad = (value: string | number | null | undefined, width: number): string =>
  String(value ?? '').padEnd(width).slice(0, width);

runScript('listTenants', async () => {
  const args = parseArgs();
  const expiringWithin = typeof args.expiring === 'string' ? Number(args.expiring) : null;

  const tenants = (await listTenants()).reverse();

  const rows = tenants
    .map((tenant) => ({ tenant, license: describeLicense(tenant.license) }))
    .filter(({ license }) =>
      expiringWithin === null ? true : license.daysLeft === null || license.daysLeft <= expiringWithin
    );

  const header = `${pad('SLUG', 24)} ${pad('COMPANY', 28)} ${pad('STATUS', 10)} ${pad('LICENCE', 8)} ${pad('EXPIRES', 11)} ${pad('DAYS', 6)} CONTACT`;
  const lines = rows.map(
    ({ tenant, license }) =>
      `${pad(tenant.slug, 24)} ${pad(tenant.name, 28)} ${pad(tenant.status, 10)} ${pad(license.state, 8)} ` +
      `${pad(license.expiresAt?.slice(0, 10), 11)} ${pad(license.daysLeft, 6)} ${tenant.contactEmail}`
  );

  process.stdout.write(['', header, '-'.repeat(header.length), ...lines, '', `  ${rows.length} of ${tenants.length} companies`, ''].join('\n'));
});

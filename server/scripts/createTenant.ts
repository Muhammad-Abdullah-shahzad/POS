/**
 * Onboard a company from the command line.
 *
 *   npm run tenant:create -- \
 *     --company "Corner Shop" \
 *     --email owner@cornershop.ie \
 *     --name "Aoife Byrne" \
 *     --password "choose-a-strong-one" \
 *     [--months 1]            paid licence instead of the default trial
 *
 * Creates the company, its first admin login, a working default setup and
 * the opening licence. The same thing happens over HTTP at
 * POST /api/platform/tenants, and customers can do it themselves at
 * POST /api/auth/register.
 */
import { describeLicense } from '../services/licenseService';
import { provisionTenant } from '../services/tenantService';
import { parseArgs, requireArg, runScript } from './lib/runScript';

runScript('createTenant', async () => {
  const args = parseArgs();
  const months = typeof args.months === 'string' ? Number(args.months) : undefined;

  const { tenant, admin } = await provisionTenant({
    company: {
      name: requireArg(args, 'company'),
      slug: typeof args.slug === 'string' ? args.slug : undefined,
      contactEmail: requireArg(args, 'email'),
      contactPhone: typeof args.phone === 'string' ? args.phone : undefined,
      plan: typeof args.plan === 'string' ? args.plan : undefined,
    },
    admin: {
      name: requireArg(args, 'name'),
      email: requireArg(args, 'email'),
      password: requireArg(args, 'password'),
    },
    // Undefined keeps the configured trial; a paid term skips it.
    license: months ? { months, kind: 'paid' } : undefined,
  });

  const license = describeLicense(tenant.license);

  process.stdout.write(
    [
      '',
      `  Company : ${tenant.name}`,
      `  Slug    : ${tenant.slug}`,
      `  Admin   : ${admin.email}`,
      `  Licence : ${license.state}${license.expiresAt ? `, until ${license.expiresAt.slice(0, 10)} (${license.kind})` : ''}`,
      '',
      ...(license.key ? ['  Licence key for the desktop till:', '', `  ${license.key}`, ''] : []),
      '  The admin can now sign in and the company starts with its own empty catalogue.',
      '',
    ].join('\n')
  );
});

/**
 * Add a staff login to an existing company.
 *
 *   npm run user:create -- \
 *     --tenant corner-shop \
 *     --name "Sean Kelly" \
 *     --email sean@cornershop.ie \
 *     --password "choose-a-strong-one" \
 *     --role cashier
 */
import { runAsTenant } from '../core/tenantContext';
import User, { USER_ROLES, UserRole, hashPassword } from '../models/User';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

runScript('createUser', async () => {
  const args = parseArgs();

  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));
  const email = requireArg(args, 'email').toLowerCase();
  const role = (typeof args.role === 'string' ? args.role : 'cashier') as UserRole;

  if (!USER_ROLES.includes(role)) {
    throw new Error(`Role must be one of: ${USER_ROLES.join(', ')}`);
  }

  const existing = await User.findOne({ email });
  if (existing) throw new Error(`${email} already has an account`);

  const passwordHash = await hashPassword(requireArg(args, 'password'));

  const user = await runAsTenant(tenant._id.toString(), () =>
    User.create({
      tenantId: tenant._id,
      name: requireArg(args, 'name'),
      email,
      role,
      passwordHash,
    })
  );

  process.stdout.write(`\n  Created ${user.email} (${user.role}) for ${tenant.name}\n\n`);
});

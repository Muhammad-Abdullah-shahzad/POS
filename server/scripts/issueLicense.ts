/**
 * Issue or extend a company's licence after they have paid.
 *
 *   npm run license:issue -- --tenant corner-shop                # one more month
 *   npm run license:issue -- --tenant corner-shop --months 3
 *   npm run license:issue -- --tenant corner-shop --days 10 --note "goodwill"
 *   npm run license:issue -- --tenant corner-shop --from-now     # restart the clock today
 *
 * When the current licence still has time left the new term is added to its
 * end; when it has run out the term starts today. The printed key is what you
 * send to the customer. Their web app is unlocked as soon as this finishes;
 * their desktop till picks the key up the next time it is online, or the
 * moment they paste it in.
 */
import { describeLicense, issueLicense } from '../services/licenseService';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

runScript('issueLicense', async () => {
  const args = parseArgs();

  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));
  const months = typeof args.months === 'string' ? Number(args.months) : undefined;
  const days = typeof args.days === 'string' ? Number(args.days) : 0;

  const updated = await issueLicense(tenant._id.toString(), {
    months: months ?? (days > 0 ? 0 : 1),
    days,
    kind: args.trial === true ? 'trial' : 'paid',
    note: typeof args.note === 'string' ? args.note : '',
    fromNow: args['from-now'] === true,
  });

  const license = describeLicense(updated.license);

  process.stdout.write(
    [
      '',
      `  Company : ${updated.name} (${updated.slug})`,
      `  Status  : ${updated.status}`,
      `  Expires : ${license.expiresAt?.slice(0, 10)}  (${license.daysLeft} days left)`,
      '',
      '  Licence key — send this to the customer:',
      '',
      `  ${license.key}`,
      '',
    ].join('\n')
  );
});

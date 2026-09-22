/**
 * Permanently delete a company and everything it owns: logins, sessions,
 * products, sales, customers, staff, expenses, settings, product images and
 * the company record with its licence. There is no undo.
 *
 *   npm run tenant:delete -- --tenant corner-shop
 *       Shows what would be deleted. Nothing is changed.
 *
 *   npm run tenant:delete -- --tenant corner-shop --confirm corner-shop
 *       Deletes it. The slug is typed twice so a wrong name cannot slip through.
 *
 * Take a backup first (mongodump) if there is any chance the data is needed.
 * Desktop tills of the company lock at their next check, as their company no
 * longer exists.
 */
import { logger } from '../core/logger';
import { countTenantData, deleteTenant } from '../services/tenantDeletionService';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

const pad = (value: string | number, width: number): string => String(value).padEnd(width);

function printTable(title: string, rows: { collection: string; documents: number }[]): void {
  const total = rows.reduce((sum, row) => sum + row.documents, 0);
  console.log(`\n${title}`);
  for (const row of rows.filter((entry) => entry.documents > 0)) {
    console.log(`  ${pad(row.collection, 22)} ${row.documents}`);
  }
  console.log(`  ${pad('total records', 22)} ${total}\n`);
}

runScript('deleteTenant', async () => {
  const args = parseArgs();
  const slug = requireArg(args, 'tenant').toLowerCase();
  const tenant = await findTenantBySlug(slug);
  const tenantId = tenant._id.toString();

  const confirmation = typeof args.confirm === 'string' ? args.confirm.trim().toLowerCase() : null;

  if (confirmation === null) {
    printTable(`${tenant.name} (${tenant.slug}) owns, plus the company record and its licence:`, await countTenantData(tenantId));
    console.log('Nothing was deleted. To delete it permanently, run:');
    console.log(`  npm run tenant:delete -- --tenant ${tenant.slug} --confirm ${tenant.slug}\n`);
    return;
  }

  if (confirmation !== tenant.slug) {
    throw new Error(`--confirm must repeat the slug exactly ("${tenant.slug}"). Nothing was deleted.`);
  }

  const removed = await deleteTenant(tenantId);
  printTable(`Deleted ${tenant.name} (${tenant.slug}) and its licence:`, removed);
  logger.info({ slug: tenant.slug }, 'Company permanently deleted');
});

/**
 * One-off migration: move single-company data into the multi-tenant model.
 *
 *   npm run migrate:multitenant -- --company "My Shop" --dry-run
 *   npm run migrate:multitenant -- --company "My Shop"
 *
 * What it does, in order:
 *   1. creates (or reuses) the company every existing record belongs to
 *   2. stamps `tenantId` on every document that does not have one yet, and
 *      backfills the account fields sign in now relies on
 *   3. keeps a single settings document per company
 *   4. renumbers receipts per company and seeds the receipt counter
 *   5. drops the old platform wide unique indexes and builds tenant scoped ones
 *   6. issues the company's first licence, so the deploy does not lock the
 *      existing customer out (`--license-months`, default 1; `--no-license` to skip)
 *
 * Data fixes run before the index build, because the new unique indexes
 * cannot be created while duplicates still exist.
 *
 * Safe to run twice: every step skips work that is already done. Take a
 * database backup first anyway — step 3 drops indexes.
 */
import mongoose from 'mongoose';
import { logger } from '../core/logger';
import Tenant from '../models/Tenant';
import { describeLicense, issueLicense } from '../services/licenseService';
import { slugify } from '../services/tenantService';
import { DEFAULT_EXPENSE_CATEGORIES } from '../models/Settings';
import { parseArgs, runScript } from './lib/runScript';
import '../models/registry';

/** Collections that gain a `tenantId`, with the legacy indexes to remove. */
const TENANT_COLLECTIONS: Array<{ model: string; staleIndexes: string[] }> = [
  { model: 'User', staleIndexes: [] },
  { model: 'Product', staleIndexes: ['barcode_1', 'sku_1'] },
  { model: 'Category', staleIndexes: ['name_1'] },
  { model: 'Order', staleIndexes: ['invoiceId_1'] },
  { model: 'Customer', staleIndexes: [] },
  { model: 'Employee', staleIndexes: [] },
  { model: 'EmployeeDamage', staleIndexes: [] },
  { model: 'Expense', staleIndexes: [] },
  { model: 'ExpenseCategory', staleIndexes: ['name_1'] },
  { model: 'Supplier', staleIndexes: [] },
  { model: 'Settings', staleIndexes: [] },
  { model: 'BankName', staleIndexes: ['name_1'] },
  { model: 'BankAccount', staleIndexes: [] },
  { model: 'BankCard', staleIndexes: [] },
];

runScript('migrateToMultiTenant', async () => {
  const args = parseArgs();
  const dryRun = args['dry-run'] === true;
  const companyName = typeof args.company === 'string' ? args.company : 'Legacy Company';

  if (dryRun) logger.info('Dry run: reporting what would change, writing nothing');

  // ── 1. The company every existing record belongs to ───────────────────────
  const slug = typeof args.slug === 'string' ? args.slug : slugify(companyName);
  let tenant = await Tenant.findOne({ slug });

  if (!tenant) {
    logger.info({ slug }, 'Creating the company for existing data');
    if (!dryRun) {
      tenant = await Tenant.create({
        name: companyName,
        slug,
        contactEmail: typeof args.email === 'string' ? args.email : `owner@${slug}.local`,
        status: 'active',
      });
    }
  } else {
    logger.info({ slug }, 'Reusing the existing company');
  }

  if (!tenant) {
    logger.info('Dry run stops here: the rest of the migration needs the company to exist');
    return;
  }

  const tenantId = tenant._id;

  // ── 2. Stamp tenantId on everything that predates it ──────────────────────
  // The native driver is used deliberately: `tenantId` is immutable at the
  // schema level, which is exactly what should stop application code from
  // rewriting it.
  for (const { model } of TENANT_COLLECTIONS) {
    const collection = mongoose.model(model).collection;
    const pending = await collection.countDocuments({ tenantId: { $exists: false } });

    if (pending === 0) {
      logger.info({ model }, 'Already migrated');
      continue;
    }

    logger.info({ model, documents: pending }, dryRun ? 'Would assign tenant' : 'Assigning tenant');
    if (!dryRun) {
      await collection.updateMany({ tenantId: { $exists: false } }, { $set: { tenantId } });
    }
  }

  if (dryRun) {
    logger.info('Dry run complete. Re-run without --dry-run to apply.');
    return;
  }

  // ── 2b. Backfill account fields introduced with multi-tenancy ─────────────
  // Queries such as the last-admin guard filter on `isActive: true` directly,
  // and a missing field never matches, so legacy accounts must carry it.
  await backfillUserFields();

  // ── 3. One settings document per company ──────────────────────────────────
  // Runs before indexes: the unique { tenantId } index cannot be built while
  // duplicate settings documents still exist.
  await collapseSettings(tenantId);

  // ── 4. Receipt numbers ────────────────────────────────────────────────────
  // Also before indexes, so { tenantId, invoiceId } is unique when it is built.
  await renumberReceipts(tenantId);

  // ── 5. Replace platform wide unique indexes with tenant scoped ones ───────
  for (const { model, staleIndexes } of TENANT_COLLECTIONS) {
    const collection = mongoose.model(model).collection;

    for (const indexName of staleIndexes) {
      try {
        await collection.dropIndex(indexName);
        logger.info({ model, indexName }, 'Dropped legacy index');
      } catch {
        // Already gone, which is the state we want.
      }
    }
  }

  for (const modelName of mongoose.modelNames()) {
    await mongoose.model(modelName).syncIndexes();
  }
  logger.info('Tenant scoped indexes built');

  // ── 6. The opening licence ────────────────────────────────────────────────
  // Every authenticated request now needs a licence in force. Issuing one here
  // means the customer whose data was just migrated keeps working the moment
  // the new build goes live, instead of seeing the renewal screen.
  await ensureLicense(tenant._id.toString(), args);

  logger.info({ tenant: tenant.name, slug: tenant.slug }, 'Migration complete');
});

async function ensureLicense(tenantId: string, args: Record<string, string | boolean>): Promise<void> {
  if (args['no-license'] === true) {
    logger.info('Skipping the licence as requested (--no-license)');
    return;
  }

  const current = await Tenant.findById(tenantId).select('license').lean();
  if (current?.license) {
    logger.info({ expiresAt: current.license.expiresAt }, 'Licence already in force, leaving it alone');
    return;
  }

  const months = typeof args['license-months'] === 'string' ? Number(args['license-months']) : 1;
  const updated = await issueLicense(tenantId, { months, kind: 'paid', note: 'Issued by the multi-tenant migration' });
  const license = describeLicense(updated.license);

  logger.info({ expiresAt: license.expiresAt }, 'Opening licence issued');
  process.stdout.write(`\n  Licence key for the desktop till (send to the customer):\n\n  ${license.key}\n\n`);
}

/**
 * Give every order a sequential receipt number within its company, in the order
 * the sales happened, then point the counter at the last one. Before this
 * change the number was recomputed by counting orders on every request.
 */
async function renumberReceipts(tenantId: mongoose.Types.ObjectId): Promise<void> {
  const orders = mongoose.model('Order').collection;
  const counters = mongoose.model('Counter').collection;

  // Older builds used several formats (REC-<ms>, INV-<ms>). Anything that is
  // not already a plain receipt number is treated as legacy.
  const isReceiptNumber = /^[1-9][0-9]*$/;

  const all = await orders
    .find({ tenantId })
    .sort({ createdAt: 1, _id: 1 })
    .project({ _id: 1, invoiceId: 1 })
    .toArray();

  const legacy = all.filter((order) => !isReceiptNumber.test(String(order.invoiceId ?? '')));
  const highestExisting = all
    .map((order) => String(order.invoiceId ?? ''))
    .filter((id) => isReceiptNumber.test(id))
    .reduce((max, id) => Math.max(max, Number(id)), 0);

  let next = highestExisting + 1;

  for (const order of legacy) {
    await orders.updateOne({ _id: order._id }, { $set: { invoiceId: String(next) } });
    next += 1;
  }

  const lastIssued = next - 1;

  // Never move the counter backwards, or a new sale could reuse a number.
  const counter = await counters.findOne({ tenantId, key: 'receipt' });
  if (!counter || (counter.value ?? 0) < lastIssued) {
    await counters.updateOne({ tenantId, key: 'receipt' }, { $set: { value: lastIssued } }, { upsert: true });
  }

  logger.info({ renumbered: legacy.length, lastReceipt: lastIssued }, 'Receipts numbered per company');
}

/** Give pre-migration accounts the fields the new auth flow relies on. */
async function backfillUserFields(): Promise<void> {
  const users = mongoose.model('User').collection;

  const activated = await users.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  const versioned = await users.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
  const normalised = await users.updateMany(
    { email: { $regex: '[A-Z]|^\\s|\\s$' } },
    [{ $set: { email: { $toLower: { $trim: { input: '$email' } } } } }]
  );

  logger.info(
    {
      activated: activated.modifiedCount,
      versioned: versioned.modifiedCount,
      emailsNormalised: normalised.modifiedCount,
    },
    'User fields backfilled'
  );
}

/** Older installs could end up with several settings rows; keep the newest. */
async function collapseSettings(tenantId: mongoose.Types.ObjectId): Promise<void> {
  const settings = mongoose.model('Settings').collection;
  const documents = await settings.find({ tenantId }).sort({ updatedAt: -1 }).toArray();

  if (documents.length === 0) {
    await settings.insertOne({
      tenantId,
      shopName: 'My Retail Store',
      shopAddress: '123 Retail Lane, Shop City',
      defaultVatRate: 20,
      isVatInclusiveDefault: true,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      quickProducts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    logger.info('Created default settings');
    return;
  }

  const [keep, ...duplicates] = documents;
  if (duplicates.length > 0) {
    await settings.deleteMany({ _id: { $in: duplicates.map((doc) => doc._id) } });
    logger.warn({ removed: duplicates.length, kept: keep._id }, 'Removed duplicate settings documents');
  }
}

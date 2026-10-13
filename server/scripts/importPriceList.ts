/**
 * Add a supplier's price list to one company's products.
 *
 *   npm run products:import -- --tenant haji-nawaz-sons-sanitary-store --file scripts/data/duraflow-pprc-2026-09-08.json
 *   npm run products:import -- --tenant haji-nawaz-sons-sanitary-store --file scripts/data/duraflow-pprc-2026-09-08.json --apply
 *
 * Without --apply it only reports what it would do. Products are named
 * "<size> <item> <company>" (e.g. "25mm Socket Duraflow"), filed under the
 * list's category (created if missing), with the list price as the selling
 * price and no stock. A product whose barcode already exists is not added
 * again, but is renamed if its name is in an older format; safe to re-run.
 */
import fs from 'fs';
import path from 'path';
import { runAsTenant } from '../core/tenantContext';
import { logger } from '../core/logger';
import Category from '../models/Category';
import Product from '../models/Product';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';
import { productsFrom, type PriceList } from './lib/priceList';

runScript('importPriceList', async () => {
  const args = parseArgs();
  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));
  const list = JSON.parse(fs.readFileSync(path.resolve(requireArg(args, 'file')), 'utf8')) as PriceList;
  const apply = args.apply === true;
  const products = productsFrom(list);
  const barcodes = new Set(products.map((p) => p.barcode));

  await runAsTenant(tenant._id.toString(), async () => {
    const existing = new Map((await Product.find({ barcode: { $in: [...barcodes] } }).select('barcode name')).map((p) => [p.barcode, p]));
    const toAdd = products.filter((p) => !existing.has(p.barcode));
    // Products already added, but named in an older format, take the current name.
    const toRename = products.filter((p) => existing.has(p.barcode) && existing.get(p.barcode)!.name !== p.name);
    const hasCategory = Boolean(await Category.findOne({ name: list.category }));

    logger.info(
      { company: tenant.slug, source: list.source, category: list.category, categoryExists: hasCategory, inList: products.length, alreadyThere: existing.size, toAdd: toAdd.length, toRename: toRename.length, apply },
      apply ? 'Importing price list' : 'Dry run: nothing will be written (add --apply to import)'
    );
    for (const product of toAdd) logger.info({ name: product.name, barcode: product.barcode, price: product.price }, apply ? 'Adding' : 'Would add');
    for (const product of toRename) logger.info({ from: existing.get(product.barcode)!.name, to: product.name }, apply ? 'Renaming' : 'Would rename');

    if (!apply) return;
    if (!hasCategory) await Category.create({ name: list.category, items: [], vatRate: 0, vatType: 'exclusive' });
    if (toAdd.length) await Product.insertMany(toAdd, { ordered: false });
    for (const product of toRename) await Product.updateOne({ _id: existing.get(product.barcode)!._id }, { $set: { name: product.name } });
    logger.info({ added: toAdd.length, renamed: toRename.length, categoryCreated: !hasCategory }, 'Price list imported');
  });
});

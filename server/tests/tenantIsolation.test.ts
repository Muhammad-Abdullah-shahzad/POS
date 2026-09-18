/**
 * The guarantee this whole design exists for: one company can never read,
 * update or delete another company's data.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { runAsTenant, withSystemScope } from '../core/tenantContext';
import { TenantScopeError } from '../core/errors';
import Product from '../models/Product';
import Customer from '../models/Customer';
import Order from '../models/Order';
import { createCompany, resetDatabase } from './helpers';

describe('tenant isolation', () => {
  let companyA: string;
  let companyB: string;

  beforeAll(async () => {
    await resetDatabase();

    const [a, b] = await Promise.all([createCompany('Alpha Store'), createCompany('Beta Store')]);
    companyA = a.tenant._id.toString();
    companyB = b.tenant._id.toString();

    await runAsTenant(companyA, () =>
      Product.create({ name: 'Alpha Milk', barcode: '1001', category: 'Dairy', price: 2, costPrice: 1, vatRate: 0, vatType: 'exclusive', stock: 10 })
    );
    await runAsTenant(companyB, () =>
      Product.create({ name: 'Beta Bread', barcode: '2001', category: 'Bakery', price: 3, costPrice: 1, vatRate: 0, vatType: 'exclusive', stock: 5 })
    );
  });

  it('returns only the caller company products', async () => {
    const alphaProducts = await runAsTenant(companyA, () => Product.find());
    const betaProducts = await runAsTenant(companyB, () => Product.find());

    expect(alphaProducts.map((p) => p.name)).toEqual(['Alpha Milk']);
    expect(betaProducts.map((p) => p.name)).toEqual(['Beta Bread']);
  });

  it('cannot read another company document by its id', async () => {
    const betaProduct = await runAsTenant(companyB, () => Product.findOne({ barcode: '2001' }));

    const stolen = await runAsTenant(companyA, () => Product.findById(betaProduct!._id));

    expect(stolen).toBeNull();
  });

  it('cannot update another company document by its id', async () => {
    const betaProduct = await runAsTenant(companyB, () => Product.findOne({ barcode: '2001' }));

    await runAsTenant(companyA, () =>
      Product.findByIdAndUpdate(betaProduct!._id, { $set: { price: 9999 } })
    );

    const unchanged = await runAsTenant(companyB, () => Product.findById(betaProduct!._id));
    expect(unchanged!.price).toBe(3);
  });

  it('cannot delete another company document by its id', async () => {
    const betaProduct = await runAsTenant(companyB, () => Product.findOne({ barcode: '2001' }));

    await runAsTenant(companyA, () => Product.findByIdAndDelete(betaProduct!._id));

    const stillThere = await runAsTenant(companyB, () => Product.findById(betaProduct!._id));
    expect(stillThere).not.toBeNull();
  });

  it('ignores a tenantId supplied by the caller', async () => {
    const customer = await runAsTenant(companyA, () =>
      // A malicious client sending another company's id must not place the row there.
      Customer.create({ name: 'Mallory', contactNum1: '0871234567', tenantId: companyB })
    );

    expect(customer.tenantId.toString()).toBe(companyA);
    const seenByB = await runAsTenant(companyB, () => Customer.findById(customer._id));
    expect(seenByB).toBeNull();
  });

  it('scopes counts and aggregations', async () => {
    await runAsTenant(companyA, () =>
      Order.create({
        invoiceId: '1',
        items: [{ name: 'Alpha Milk', quantity: 1, price: 2, vatRate: 0, vatAmount: 0, totalPrice: 2 }],
        subtotal: 2,
        totalVAT: 0,
        discount: 0,
        total: 2,
        paymentMethod: 'cash',
      })
    );

    expect(await runAsTenant(companyA, () => Order.countDocuments())).toBe(1);
    expect(await runAsTenant(companyB, () => Order.countDocuments())).toBe(0);

    const betaTotals = await runAsTenant(companyB, () =>
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }])
    );
    expect(betaTotals).toEqual([]);
  });

  it('allows the same barcode in two different companies', async () => {
    await expect(
      runAsTenant(companyB, () =>
        Product.create({ name: 'Beta Milk', barcode: '1001', category: 'Dairy', price: 2, costPrice: 1, vatRate: 0, vatType: 'exclusive', stock: 4 })
      )
    ).resolves.toBeDefined();
  });

  it('refuses to run a tenant scoped query with no scope at all', async () => {
    await expect(Product.find().exec()).rejects.toThrow(TenantScopeError);
  });

  it('reaches across companies only inside the system scope', async () => {
    const all = await withSystemScope(() => Product.find());
    expect(all.length).toBeGreaterThan(1);
  });
});

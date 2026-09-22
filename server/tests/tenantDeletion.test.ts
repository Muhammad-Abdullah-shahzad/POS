/**
 * Deleting a company removes everything it owns, its logins and its licence,
 * and leaves every other company exactly as it was.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app';
import { runAsTenant, withSystemScope } from '../core/tenantContext';
import Product from '../models/Product';
import Session from '../models/Session';
import SupplierInvoice from '../models/SupplierInvoice';
import Tenant from '../models/Tenant';
import User from '../models/User';
import { countTenantData, deleteTenant } from '../services/tenantDeletionService';
import { createCompany, resetDatabase } from './helpers';

const app = createApp();
const total = (counts: { documents: number }[]) => counts.reduce((sum, entry) => sum + entry.documents, 0);

describe('deleting a company', () => {
  let doomed = '';
  let kept = '';
  let keptBefore = 0;

  beforeAll(async () => {
    await resetDatabase();
    const [a, b] = await Promise.all([createCompany('Doomed Store'), createCompany('Kept Store')]);
    doomed = a.tenant._id.toString();
    kept = b.tenant._id.toString();

    for (const [tenantId, barcode] of [[doomed, '1'], [kept, '2']]) {
      await runAsTenant(tenantId, async () => {
        await Product.create({ name: 'Milk', barcode, category: 'Dairy', price: 2, costPrice: 1, vatRate: 0, vatType: 'exclusive', stock: 5 });
        await SupplierInvoice.create({ supplierName: 'Dairy Co', invoiceNo: `D-${barcode}`, amount: 50, date: new Date() });
      });
    }

    // A signed-in session, so logins are covered too.
    await request(app).post('/api/auth/login').send({ email: a.admin.email, password: 'correct horse battery' }).expect(200);

    keptBefore = total(await countTenantData(kept));
  });

  it('reports what a company owns without changing anything', async () => {
    const counts = await countTenantData(doomed);
    const byCollection = Object.fromEntries(counts.map((entry) => [entry.collection, entry.documents]));

    expect(byCollection).toMatchObject({ users: 1, products: 1, supplierinvoices: 1, settings: 1 });
    expect(byCollection.sessions).toBeGreaterThan(0);
    expect(await withSystemScope(() => Tenant.exists({ _id: doomed }))).toBeTruthy();
  });

  it('removes the company, its licence, its logins and every record it owns', async () => {
    await deleteTenant(doomed);

    expect(await withSystemScope(() => Tenant.exists({ _id: doomed }))).toBeNull();
    expect(total(await countTenantData(doomed))).toBe(0);

    const tenantId = new Types.ObjectId(doomed);
    expect(await withSystemScope(() => User.countDocuments({ tenantId }))).toBe(0);
    expect(await withSystemScope(() => Session.countDocuments({ tenantId }))).toBe(0);
  });

  it('leaves other companies untouched', async () => {
    expect(await withSystemScope(() => Tenant.exists({ _id: kept }))).toBeTruthy();
    expect(total(await countTenantData(kept))).toBe(keptBefore);
  });

  it('refuses an unknown company', async () => {
    await expect(deleteTenant(new Types.ObjectId().toString())).rejects.toThrow();
  });
});

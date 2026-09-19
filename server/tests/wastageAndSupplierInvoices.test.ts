/**
 * Wastage and supplier invoices belong to one company: a new company starts
 * with none, and no company can read, pay or write off another's records.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Product from '../models/Product';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const onboard = (company: string, email: string) =>
  request(app)
    .post('/api/platform/tenants')
    .set('x-platform-key', env.platformApiKey)
    .send({ company: { name: company, contactEmail: email }, admin: { name: 'Owner', email, password: PASSWORD } });

const signIn = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.data.accessToken as string;

describe('wastage and supplier invoices', () => {
  let alpha = '';
  let beta = '';
  let alphaTenant = '';
  let productId = '';

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const stockOnHand = async () => (await runAsTenant(alphaTenant, () => Product.findById(productId)))!.stock;

  beforeAll(async () => {
    await resetDatabase();
    const alphaCompany = await onboard('Alpha Store', 'alpha-waste@example.com');
    await onboard('Beta Store', 'beta-waste@example.com');
    alpha = await signIn('alpha-waste@example.com');
    beta = await signIn('beta-waste@example.com');

    alphaTenant = alphaCompany.body.data.tenant.id;
    const product = await runAsTenant(alphaTenant, () =>
      Product.create({ name: 'Cooking Oil 5L', sku: 'OIL-5L', barcode: '5001', category: 'Pantry', price: 10, costPrice: 7.5, vatRate: 0, vatType: 'inclusive', stock: 10 })
    );
    productId = product._id.toString();
  });

  it('starts a new company with an empty wastage log and no supplier invoices', async () => {
    const wastage = await request(app).get('/api/wastage').set(as(beta));
    const invoices = await request(app).get('/api/supplier-invoices').set(as(beta));

    expect(wastage.status).toBe(200);
    expect(wastage.body.data).toEqual([]);
    expect(invoices.body.data).toEqual([]);
  });

  it('writes stock off and logs it with the cost at the time', async () => {
    const response = await request(app).post('/api/wastage').set(as(alpha)).send({ productId, quantity: 3, reason: 'Broken / Spilled' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ productName: 'Cooking Oil 5L', sku: 'OIL-5L', quantity: 3, unitCost: 7.5 });

    expect(await stockOnHand()).toBe(7);

    const log = await request(app).get('/api/wastage').set(as(alpha));
    expect(log.body.data).toHaveLength(1);
  });

  it('refuses to write off more than is in stock', async () => {
    const response = await request(app).post('/api/wastage').set(as(alpha)).send({ productId, quantity: 50, reason: 'Expired Stock' });

    expect(response.status).toBe(400);
    expect(await stockOnHand()).toBe(7);
  });

  it("keeps each company's wastage to itself", async () => {
    const log = await request(app).get('/api/wastage').set(as(beta));
    expect(log.body.data).toEqual([]);

    // Another company cannot write off this company's stock, even with its id.
    const attempt = await request(app).post('/api/wastage').set(as(beta)).send({ productId, quantity: 1, reason: 'Expired Stock' });
    expect(attempt.status).toBe(404);
  });

  it('tracks supplier invoice payments up to the amount owed', async () => {
    const created = await request(app)
      .post('/api/supplier-invoices')
      .set(as(alpha))
      .send({ supplierName: 'Fresh Fields', invoiceNo: 'FF-100', amount: 450.3, paid: 100, date: '2026-09-01' });
    expect(created.status).toBe(201);
    const id = created.body.data._id;

    const partial = await request(app).post(`/api/supplier-invoices/${id}/payments`).set(as(alpha)).send({ amount: 150.1 });
    expect(partial.body.data.paid).toBeCloseTo(250.1);

    const overpaid = await request(app).post(`/api/supplier-invoices/${id}/payments`).set(as(alpha)).send({ amount: 500 });
    expect(overpaid.status).toBe(400);

    const settled = await request(app).post(`/api/supplier-invoices/${id}/payments`).set(as(alpha)).send({ amount: 200.2 });
    expect(settled.body.data.paid).toBeCloseTo(450.3);
  });

  it('rejects an invoice paid beyond its amount', async () => {
    const response = await request(app)
      .post('/api/supplier-invoices')
      .set(as(alpha))
      .send({ supplierName: 'Fresh Fields', invoiceNo: 'FF-101', amount: 100, paid: 120, date: '2026-09-02' });
    expect(response.status).toBe(422);
  });

  it("keeps each company's supplier invoices to itself", async () => {
    const [invoice] = (await request(app).get('/api/supplier-invoices').set(as(alpha))).body.data;

    const seen = await request(app).get('/api/supplier-invoices').set(as(beta));
    expect(seen.body.data).toEqual([]);

    await request(app).post(`/api/supplier-invoices/${invoice._id}/payments`).set(as(beta)).send({ amount: 1 }).expect(404);
    await request(app).delete(`/api/supplier-invoices/${invoice._id}`).set(as(beta)).expect(404);

    const untouched = await request(app).get('/api/supplier-invoices').set(as(alpha));
    expect(untouched.body.data).toHaveLength(1);
  });
});

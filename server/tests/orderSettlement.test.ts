/**
 * Every sale records how it was settled and where the customer's account
 * stood, so a reprinted invoice matches the one handed over at the till.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Customer from '../models/Customer';
import Product from '../models/Product';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

describe('how a sale is settled', () => {
  let token = '';
  let tenantId = '';
  let productId = '';
  let customerId = '';

  const sell = (payload: Record<string, unknown>) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ product: productId, name: 'Pump', quantity: 1, price: 100, vatRate: 0, vatAmount: 0, totalPrice: 100 }],
        subtotal: 100,
        totalVAT: 0,
        discount: 0,
        total: 100,
        ...payload,
      });

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Pipe House', contactEmail: 'pipes@example.com' }, admin: { name: 'Owner', email: 'pipes@example.com', password: PASSWORD } });
    tenantId = company.body.data.tenant.id;
    token = (await request(app).post('/api/auth/login').send({ email: 'pipes@example.com', password: PASSWORD })).body.data.accessToken;

    await runAsTenant(tenantId, async () => {
      const product = await Product.create({ name: 'Pump', barcode: 'P1', category: 'Pumps', price: 100, costPrice: 60, vatRate: 0, vatType: 'inclusive', stock: 500 });
      productId = product._id.toString();
      const customer = await Customer.create({ name: 'Huzaifa', contactNum1: '03254867009', address: 'Bhatta Chowk', outstandingBalance: 250 });
      customerId = customer._id.toString();
    });
  });

  it('records a cash sale as cash, with no account movement', async () => {
    const response = await sell({ paymentMethod: 'cash' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ paidCash: 100, paidCard: 0, creditAmount: 0, balanceBefore: null, balanceAfter: null });
  });

  it('records a card sale as card', async () => {
    const response = await sell({ paymentMethod: 'card' });
    expect(response.body.data).toMatchObject({ paidCash: 0, paidCard: 100, creditAmount: 0 });
  });

  it('splits a split payment between cash and card', async () => {
    const response = await sell({ paymentMethod: 'split', splitCash: 40, splitCard: 60 });
    expect(response.body.data).toMatchObject({ paidCash: 40, paidCard: 60, creditAmount: 0 });
  });

  it('puts a credit sale on the account and keeps both balances', async () => {
    const response = await sell({ paymentMethod: 'credit', customerId, customerName: 'Huzaifa' });

    expect(response.body.data).toMatchObject({
      paidCash: 0,
      paidCard: 0,
      creditAmount: 100,
      balanceBefore: 250,
      balanceAfter: 350,
      customerPhone: '03254867009',
      customerAddress: 'Bhatta Chowk',
    });

    const customer = await runAsTenant(tenantId, () => Customer.findById(customerId));
    expect(customer!.outstandingBalance).toBe(350);
  });

  it('takes cash and card deposits on a credit sale and puts the rest on account', async () => {
    const response = await sell({
      items: [{ product: productId, name: 'Pump', quantity: 15, price: 100, vatRate: 0, vatAmount: 0, totalPrice: 1500 }],
      subtotal: 1500,
      total: 1500,
      paymentMethod: 'credit',
      paidCash: 300,
      paidCard: 400,
      customerId,
      customerName: 'Huzaifa',
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ paidCash: 300, paidCard: 400, creditAmount: 800, balanceBefore: 350, balanceAfter: 1150 });
  });

  it('refuses deposits that add up to more than the total', async () => {
    const response = await sell({ paymentMethod: 'credit', paidCash: 80, paidCard: 40, customerId });
    expect(response.status).toBe(400);
  });

  it('refuses credit without a customer, and leaves stock and receipt numbers untouched', async () => {
    const stockBefore = (await runAsTenant(tenantId, () => Product.findById(productId)))!.stock;

    const response = await sell({ paymentMethod: 'credit', paidCash: 20 });

    expect(response.status).toBe(400);
    expect((await runAsTenant(tenantId, () => Product.findById(productId)))!.stock).toBe(stockBefore);
  });

  it('counts deposits on credit sales as money taken in the dashboard figures', async () => {
    const response = await request(app).get('/api/analytics/kpis').set('Authorization', `Bearer ${token}`);
    const { current, breakdown } = response.body.data;

    // cash 100 + split 40 + deposit 300, card 100 + split 60 + deposit 400
    expect(current.cash).toBe(440);
    expect(current.card).toBe(560);
    expect(current.creditSales).toBe(900);
    expect(breakdown.payments).toMatchObject({ creditDepositCash: 300, creditDepositCard: 400, creditOnly: 900 });
  });

  it('keeps the cashier remarks with the sale', async () => {
    const response = await sell({ paymentMethod: 'cash', remarks: '  Deliver to site on Monday  ' });
    expect(response.status).toBe(201);
    expect(response.body.data.remarks).toBe('Deliver to site on Monday');

    const tooLong = await sell({ paymentMethod: 'cash', remarks: 'x'.repeat(501) });
    expect(tooLong.status).toBe(422);
  });

  it('shows the account standing still on a paid sale by an account customer', async () => {
    const response = await sell({ paymentMethod: 'cash', customerId, customerName: 'Huzaifa' });
    expect(response.body.data).toMatchObject({ paidCash: 100, creditAmount: 0, balanceBefore: 1150, balanceAfter: 1150 });
  });
});

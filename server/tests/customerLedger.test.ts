/**
 * Corrections made from a customer's account statement move the outstanding
 * balance by exactly the difference they make, and keep each sale's cash,
 * card and credit adding up to its total, so receipts and KPIs follow.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Customer from '../models/Customer';
import CustomerPayment from '../models/CustomerPayment';
import Order from '../models/Order';
import Product from '../models/Product';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

describe('customer account corrections', () => {
  let tenantId = '';
  let admin = '';
  let cashier = '';
  let productId = '';
  let customerId = '';

  const call = (token: string, method: 'get' | 'post' | 'put' | 'patch', url: string, body?: Record<string, unknown>) => {
    const pending = request(app)[method](`/api${url}`).set('Authorization', `Bearer ${token}`);
    return body ? pending.send(body) : pending;
  };

  const balance = async () =>
    runAsTenant(tenantId, async () => (await Customer.findById(customerId))!.outstandingBalance);

  /** A sale of `total`, with `deposit` paid in cash at the till and the rest on account. */
  const creditSale = async (total: number, deposit = 0) =>
    (
      await call(admin, 'post', '/orders', {
        items: [{ product: productId, name: 'Pump', quantity: 1, price: total, vatRate: 0, vatAmount: 0, totalPrice: total }],
        subtotal: total,
        totalVAT: 0,
        discount: 0,
        total,
        paymentMethod: 'credit',
        paidCash: deposit,
        customerId,
      })
    ).body.data;

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Ledger Shop', contactEmail: 'ledger-shop@example.com' }, admin: { name: 'Owner', email: 'ledger-shop@example.com', password: PASSWORD } });
    tenantId = company.body.data.tenant.id;
    admin = (await request(app).post('/api/auth/login').send({ email: 'ledger-shop@example.com', password: PASSWORD })).body.data.accessToken;

    await call(admin, 'post', '/users', { name: 'Till', email: 'till@example.com', password: PASSWORD, role: 'cashier' });
    cashier = (await request(app).post('/api/auth/login').send({ email: 'till@example.com', password: PASSWORD })).body.data.accessToken;

    await runAsTenant(tenantId, async () => {
      productId = (await Product.create({ name: 'Pump', barcode: 'P1', category: 'Pumps', price: 100, costPrice: 60, vatRate: 0, vatType: 'inclusive', stock: 1000 }))._id.toString();
    });
  });

  beforeEach(async () => {
    await runAsTenant(tenantId, async () => {
      await Order.deleteMany({});
      await CustomerPayment.deleteMany({});
      await Customer.deleteMany({});
      customerId = (await Customer.create({ name: 'Aisha', contactNum1: '0851', openingBalance: 50, outstandingBalance: 50 }))._id.toString();
    });
  });

  it('keeps what the customer owes when their details are edited', async () => {
    const response = await call(admin, 'put', `/customers/${customerId}`, { name: 'Aisha Siddiqui', contactNum1: '0851' });
    expect(response.status).toBe(200);
    expect(await balance()).toBe(50);
  });

  it('moves what the customer owes when the opening balance is changed, from the form or the statement', async () => {
    await call(admin, 'put', `/customers/${customerId}`, { name: 'Aisha', contactNum1: '0851', openingBalance: 80 });
    expect(await balance()).toBe(80);

    const response = await call(admin, 'patch', `/customers/${customerId}/opening-balance`, { openingBalance: 20 });
    expect(response.status).toBe(200);
    expect(response.body.data.customer).toMatchObject({ openingBalance: 20, outstandingBalance: 20 });
  });

  it('corrects a payment amount, method and notes, and moves the balance by the difference', async () => {
    const paid = await call(admin, 'post', `/customers/${customerId}/payments`, { amountPaid: 30, paymentMethod: 'cash' });
    const paymentId = paid.body.data.payment._id;
    expect(await balance()).toBe(20);

    const response = await call(admin, 'patch', `/customers/${customerId}/payments/${paymentId}`, { amountPaid: 45, paymentMethod: 'card', notes: 'Card, not cash' });
    expect(response.status).toBe(200);
    expect(response.body.data.payment).toMatchObject({ amountPaid: 45, paymentMethod: 'card', notes: 'Card, not cash' });
    expect(await balance()).toBe(5);

    await call(admin, 'patch', `/customers/${customerId}/payments/${paymentId}`, { amountPaid: 10 });
    expect(await balance()).toBe(40);
  });

  it('refuses a payment correction that would take the balance below zero', async () => {
    const paid = await call(admin, 'post', `/customers/${customerId}/payments`, { amountPaid: 30, paymentMethod: 'cash' });
    const response = await call(admin, 'patch', `/customers/${customerId}/payments/${paid.body.data.payment._id}`, { amountPaid: 81 });

    expect(response.status).toBe(400);
    expect(await balance()).toBe(20);
  });

  it('moves the rest of a sale to the till when less goes on account, and updates its receipt', async () => {
    const sale = await creditSale(100, 20);
    expect(await balance()).toBe(130);

    const response = await call(admin, 'patch', `/customers/${customerId}/sales/${sale._id}`, { creditAmount: 30, remarks: 'Paid more in cash' });
    expect(response.status).toBe(200);
    expect(response.body.data.order).toMatchObject({
      paidCash: 70,
      paidCard: 0,
      creditAmount: 30,
      paymentMethod: 'credit',
      balanceBefore: 50,
      balanceAfter: 80,
      remarks: 'Paid more in cash',
    });
    expect(await balance()).toBe(80);
  });

  it('turns a sale into a plain cash sale when nothing is left on account', async () => {
    const sale = await creditSale(100);
    const response = await call(admin, 'patch', `/customers/${customerId}/sales/${sale._id}`, { creditAmount: 0 });

    expect(response.body.data.order).toMatchObject({ paidCash: 100, paidCard: 0, creditAmount: 0, paymentMethod: 'cash' });
    expect(await balance()).toBe(50);
  });

  it('refuses to put more than the sale total on account', async () => {
    const sale = await creditSale(100);
    const response = await call(admin, 'patch', `/customers/${customerId}/sales/${sale._id}`, { creditAmount: 101 });

    expect(response.status).toBe(400);
    expect(await balance()).toBe(150);
  });

  it('deletes a payment, so the customer owes that amount again', async () => {
    const paid = await call(admin, 'post', `/customers/${customerId}/payments`, { amountPaid: 30, paymentMethod: 'cash' });
    expect(await balance()).toBe(20);

    const response = await request(app)
      .delete(`/api/customers/${customerId}/payments/${paid.body.data.payment._id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(await balance()).toBe(50);
    expect(await runAsTenant(tenantId, () => CustomerPayment.countDocuments({ customerId }))).toBe(0);
  });

  it('takes a voided sale off the customer account and returns its stock', async () => {
    const stockBefore = await runAsTenant(tenantId, async () => (await Product.findById(productId))!.stock);
    const sale = await creditSale(100, 20);
    expect(await balance()).toBe(130);

    const response = await request(app)
      .delete(`/api/orders/${sale._id}`)
      .query({ reason: "Deleted from the customer's statement" })
      .set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(await balance()).toBe(50);
    expect(await runAsTenant(tenantId, async () => (await Product.findById(productId))!.stock)).toBe(stockBefore);
  });

  it("only lets managers correct the statement", async () => {
    const sale = await creditSale(100);
    const response = await call(cashier, 'patch', `/customers/${customerId}/sales/${sale._id}`, { remarks: 'Changed by the till' });
    expect(response.status).toBe(403);

    const paid = await call(admin, 'post', `/customers/${customerId}/payments`, { amountPaid: 10, paymentMethod: 'cash' });
    const removal = await request(app)
      .delete(`/api/customers/${customerId}/payments/${paid.body.data.payment._id}`)
      .set('Authorization', `Bearer ${cashier}`);
    expect(removal.status).toBe(403);
  });

  it("refuses to correct another customer's payment", async () => {
    const paid = await call(admin, 'post', `/customers/${customerId}/payments`, { amountPaid: 10, paymentMethod: 'cash' });
    const other = await runAsTenant(tenantId, () => Customer.create({ name: 'Bilal', contactNum1: '0852' }));

    const response = await call(admin, 'patch', `/customers/${other._id}/payments/${paid.body.data.payment._id}`, { amountPaid: 5 });
    expect(response.status).toBe(404);
  });
});

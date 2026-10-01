/**
 * Product returns: against a sale (refunded at what was paid, never more than
 * was sold) or open (the cashier's price and discount). Stock always comes
 * back; a refund to a customer's account takes it off what they owe.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Customer from '../models/Customer';
import Order from '../models/Order';
import Product from '../models/Product';
import ProductReturn from '../models/ProductReturn';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

describe('product returns', () => {
  let tenantId = '';
  let token = '';
  let pumpId = '';
  let pipeId = '';
  let customerId = '';

  const call = (method: 'get' | 'post' | 'delete', url: string, body?: Record<string, unknown>) => {
    const pending = request(app)[method](`/api${url}`).set('Authorization', `Bearer ${token}`);
    return body ? pending.send(body) : pending;
  };
  const stock = (id: string) => runAsTenant(tenantId, async () => (await Product.findById(id))!.stock);
  const balance = () => runAsTenant(tenantId, async () => (await Customer.findById(customerId))!.outstandingBalance);

  /** A sale of 3 pumps at 10 (one discounted line) and 2 pipes at 4.50 with a 0.25 deposit each. */
  const sell = async (extra: Record<string, unknown> = {}) =>
    (
      await call('post', '/orders', {
        items: [
          { product: pumpId, name: 'Pump', quantity: 3, price: 9, vatRate: 0, vatAmount: 0, totalPrice: 30, finalPrice: 27, discountPct: 10 },
          { product: pipeId, name: 'Pipe', quantity: 2, price: 4.5, vatRate: 0, vatAmount: 0, totalPrice: 9, finalPrice: 9.5, drs: 0.25 },
        ],
        subtotal: 36.5,
        totalVAT: 0,
        discount: 3,
        total: 36.5,
        paymentMethod: 'cash',
        ...extra,
      })
    ).body.data;

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Return Shop', contactEmail: 'ret@example.com' }, admin: { name: 'Owner', email: 'ret@example.com', password: PASSWORD } });
    tenantId = company.body.data.tenant.id;
    token = (await request(app).post('/api/auth/login').send({ email: 'ret@example.com', password: PASSWORD })).body.data.accessToken;
  });

  beforeEach(async () => {
    await runAsTenant(tenantId, async () => {
      await Promise.all([Order.deleteMany({}), ProductReturn.deleteMany({}), Product.deleteMany({}), Customer.deleteMany({})]);
      pumpId = String((await Product.create({ name: 'Pump', barcode: 'P1', category: 'Pumps', price: 10, costPrice: 6, vatRate: 0, vatType: 'inclusive', stock: 100 }))._id);
      pipeId = String((await Product.create({ name: 'Pipe', barcode: 'P2', category: 'Pipes', price: 4.5, costPrice: 2, vatRate: 0, vatType: 'inclusive', stock: 100 }))._id);
      customerId = String((await Customer.create({ name: 'Aisha', contactNum1: '0851', outstandingBalance: 0 }))._id);
    });
  });

  it('refunds returned items at what was paid for them and puts them back in stock', async () => {
    const sale = await sell();
    expect(await stock(pumpId)).toBe(97);

    const response = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 2 }, { orderLine: 1, quantity: 1 }], refundMethod: 'cash', reason: 'Wrong size' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      type: 'invoice',
      invoiceId: sale.invoiceId,
      total: 22.75, // 2 × 9 (after discount) + 1 × 4.75 (price and deposit)
      refundCash: 22.75,
      refundToAccount: 0,
    });
    expect(response.body.data.returnNo).toMatch(/^RET-\d+$/);
    expect(await stock(pumpId)).toBe(99);
    expect(await stock(pipeId)).toBe(99);
  });

  it('never returns more of a line than was sold, counting earlier returns, and refunds the last unit exactly', async () => {
    const sale = await sell();
    await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 2 }], refundMethod: 'cash' });

    const tooMany = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 2 }], refundMethod: 'cash' });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toContain('Only 1 of Pump');

    const last = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 1 }], refundMethod: 'cash' });
    expect(last.body.data.total).toBe(9);

    const lines = (await call('get', `/returns/sale/${sale._id}`)).body.data.lines;
    expect(lines[0]).toMatchObject({ sold: 3, returned: 3, refunded: 27 });
  });

  it("takes a refund off the customer's account, paying anything beyond what they owe in cash", async () => {
    const sale = await sell({ paymentMethod: 'credit', customerId, customerName: 'Aisha' });
    expect(await balance()).toBe(36.5);
    await runAsTenant(tenantId, () => Customer.updateOne({ _id: customerId }, { $set: { outstandingBalance: 10, totalAmount: 36.5 } }));

    const response = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 2 }], refundMethod: 'account' });
    expect(response.body.data).toMatchObject({ total: 18, refundToAccount: 10, refundCash: 8, customerId, customerName: 'Aisha' });
    expect(await balance()).toBe(0);
    // Their total spent drops by what they got back.
    expect(await runAsTenant(tenantId, async () => (await Customer.findById(customerId))!.totalAmount)).toBe(18.5);

    const ledger = (await call('get', `/customers/${customerId}/ledger`)).body.data;
    expect(ledger.returns).toHaveLength(1);
  });

  it('refuses an account refund when the sale has no customer', async () => {
    const sale = await sell();
    const response = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 1 }], refundMethod: 'account' });
    expect(response.status).toBe(400);
    expect(await stock(pumpId)).toBe(97);
  });

  it('refuses returns from a voided sale', async () => {
    const sale = await sell();
    await call('delete', `/orders/${sale._id}?reason=test`);
    const response = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 0, quantity: 1 }], refundMethod: 'cash' });
    expect(response.status).toBe(400);
  });

  it('takes an open return at the price and discount given, and restocks it', async () => {
    const response = await call('post', '/returns', {
      type: 'open',
      items: [{ product: pumpId, quantity: 2, unitPrice: 10, discountPct: 20 }],
      refundMethod: 'card',
      reason: 'No receipt',
    });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ type: 'open', total: 16, refundCard: 16, refundCash: 0, orderId: null, customerId: null });
    expect(response.body.data.items[0]).toMatchObject({ name: 'Pump', unitPrice: 8, discountPct: 20, total: 16 });
    expect(await stock(pumpId)).toBe(102);
  });

  it('refuses an account refund on an open return', async () => {
    const response = await call('post', '/returns', { type: 'open', items: [{ product: pumpId, quantity: 1, unitPrice: 10 }], refundMethod: 'account' });
    expect(response.status).toBe(422);
  });

  it('finds returns by receipt or return number', async () => {
    const sale = await sell();
    const created = await call('post', '/returns', { type: 'invoice', orderId: sale._id, items: [{ orderLine: 1, quantity: 1 }], refundMethod: 'cash' });
    expect((await call('get', `/returns?search=${sale.invoiceId}`)).body.data).toHaveLength(1);
    expect((await call('get', `/returns?search=${created.body.data.returnNo}`)).body.data).toHaveLength(1);
  });
});

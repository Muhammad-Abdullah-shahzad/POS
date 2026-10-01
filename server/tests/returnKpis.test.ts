/**
 * Returns move the figures the dashboards show: a refund paid in cash or by
 * card comes off cash, card, sales and profit; a refund taken off a customer
 * account lowers the credit given; best sellers are net of what came back.
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

describe('returns in the KPIs', () => {
  let token = '';
  let pumpId = '';
  let customerId = '';

  const call = (method: 'get' | 'post', url: string, body?: Record<string, unknown>) => {
    const pending = request(app)[method](`/api${url}`).set('Authorization', `Bearer ${token}`);
    return body ? pending.send(body) : pending;
  };
  const sale = async (paymentMethod: string, extra: Record<string, unknown> = {}) =>
    (
      await call('post', '/orders', {
        items: [{ product: pumpId, name: 'Pump', quantity: 4, price: 10, vatRate: 0, vatAmount: 0, totalPrice: 40, finalPrice: 40 }],
        subtotal: 40,
        totalVAT: 0,
        discount: 0,
        total: 40,
        paymentMethod,
        ...extra,
      })
    ).body.data;
  const kpis = async () => (await call('get', '/analytics/kpis')).body.data;

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'KPI Shop', contactEmail: 'kpi-ret@example.com' }, admin: { name: 'Owner', email: 'kpi-ret@example.com', password: PASSWORD } });
    const tenantId = company.body.data.tenant.id;
    token = (await request(app).post('/api/auth/login').send({ email: 'kpi-ret@example.com', password: PASSWORD })).body.data.accessToken;
    await runAsTenant(tenantId, async () => {
      pumpId = String((await Product.create({ name: 'Pump', barcode: 'P1', category: 'Pumps', price: 10, costPrice: 6, vatRate: 0, vatType: 'inclusive', stock: 100 }))._id);
      customerId = String((await Customer.create({ name: 'Aisha', contactNum1: '0851' }))._id);
    });
  });

  it('takes refunds off cash, card, sales, profit and credit given, and nets the best sellers', async () => {
    const cashSale = await sale('cash');
    const cardSale = await sale('card');
    const creditSale = await sale('credit', { customerId, customerName: 'Aisha' });

    const before = (await kpis()).current;
    expect(before).toMatchObject({ sales: 80, cash: 40, card: 40, creditSales: 40, profit: 80, refunds: 0, returns: 0 });

    await call('post', '/returns', { type: 'invoice', orderId: cashSale._id, items: [{ orderLine: 0, quantity: 1 }], refundMethod: 'cash' });
    await call('post', '/returns', { type: 'invoice', orderId: cardSale._id, items: [{ orderLine: 0, quantity: 2 }], refundMethod: 'card' });
    await call('post', '/returns', { type: 'invoice', orderId: creditSale._id, items: [{ orderLine: 0, quantity: 3 }], refundMethod: 'account' });

    const after = await kpis();
    expect(after.current).toMatchObject({ sales: 50, cash: 30, card: 20, creditSales: 10, profit: 50, refunds: 60, returns: 3 });
    expect(after.breakdown.returns).toEqual({ count: 3, total: 60, cash: 10, card: 20, toAccount: 30 });
    expect(after.breakdown.topProducts[0]).toEqual({ name: 'Pump', quantity: 6, revenue: 60 });

    // Today's point of the daily series follows the same rules.
    const today = after.daily[after.daily.length - 1];
    expect(today).toMatchObject({ sales: 50, cash: 30, card: 20, refunds: 60 });
  });

  it('nets the Analysis page and the counter best sellers, and the monthly summary', async () => {
    const top = (await call('get', '/analytics/top-products')).body.data;
    expect(top[0]).toMatchObject({ name: 'Pump', totalQty: 6, totalRevenue: 60 });

    const monthly = (await call('get', '/analytics/monthly-summary')).body.data.monthly;
    const thisMonth = monthly[monthly.length - 1];
    // Cash and card sales (80), less refunds paid out (30); the account refund moved no money.
    expect(thisMonth).toMatchObject({ revenue: 50, profit: 50, refunds: 30, returns: 3 });
  });
});

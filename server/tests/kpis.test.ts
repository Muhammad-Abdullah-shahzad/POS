/**
 * Dashboard KPIs: month to date against the same days of last month, cash and
 * card split correctly, voided sales and other companies left out.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Order from '../models/Order';
import Expense from '../models/Expense';
import { kpiWindows } from '../services/kpiService';
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

const order = (createdAt: Date, total: number, paymentMethod: string, extra: Record<string, unknown> = {}) => ({
  invoiceId: `${createdAt.getTime()}-${Math.random()}`,
  items: [{ name: 'Item', quantity: 1, price: total, vatRate: 0, vatAmount: 0, totalPrice: total }],
  subtotal: total,
  totalVAT: 0,
  discount: 0,
  total,
  paymentMethod,
  createdAt,
  ...extra,
});

describe('dashboard KPIs', () => {
  let token = '';

  beforeAll(async () => {
    await resetDatabase();
    const alpha = await onboard('Alpha Store', 'alpha-kpi@example.com');
    const beta = await onboard('Beta Store', 'beta-kpi@example.com');
    token = await signIn('alpha-kpi@example.com');

    const { currentFrom, previousFrom } = kpiWindows();
    const thisMonth = new Date(currentFrom.getTime() + 1000);
    const lastMonth = new Date(previousFrom.getTime() + 1000);

    await runAsTenant(alpha.body.data.tenant.id, async () => {
      await Order.create([
        order(thisMonth, 40, 'cash'),
        order(thisMonth, 30, 'card'),
        order(thisMonth, 50, 'split', { splitCash: 20, splitCard: 30 }),
        order(thisMonth, 999, 'cash', { status: 'voided' }),
        order(lastMonth, 60, 'cash'),
      ]);
      await Expense.create({ title: 'Rent', amount: 20, category: 'Rent', paymentMethod: 'cash', date: thisMonth });
    });

    // A second company's sales must never appear in Alpha's figures.
    await runAsTenant(beta.body.data.tenant.id, () => Order.create([order(thisMonth, 5000, 'cash')]));
  });

  it('reports this month against the same days of last month', async () => {
    const response = await request(app).get('/api/analytics/kpis').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const { current, previous, daily, catalogue } = response.body.data;

    expect(current.sales).toBe(120);
    expect(current.orders).toBe(3);
    expect(current.cash).toBe(60);
    expect(current.card).toBe(60);
    expect(current.expenses).toBe(20);
    expect(current.profit).toBe(100);
    expect(previous.sales).toBe(60);

    expect(daily).toHaveLength(30);
    expect(catalogue).toMatchObject({ products: 0, lowStock: 0, outOfStock: 0 });
  });

  it('breaks the month down for the detail views', async () => {
    const response = await request(app).get('/api/analytics/kpis').set('Authorization', `Bearer ${token}`);
    const { breakdown } = response.body.data;

    expect(breakdown.payments).toEqual({
      cashOrders: 1,
      cashOnly: 40,
      cardOrders: 1,
      cardOnly: 30,
      splitOrders: 1,
      splitCash: 20,
      splitCard: 30,
    });
    expect(breakdown.expenseCategories).toEqual([{ category: 'Rent', total: 20, count: 1 }]);
    expect(breakdown.expenseCount).toBe(1);
    // Voided and last month's sales are left out.
    expect(breakdown.topProducts).toEqual([{ name: 'Item', quantity: 3, revenue: 120 }]);
    expect(breakdown.lowStockItems).toEqual([]);
  });

  it('is limited to admins and managers', async () => {
    const cashier = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Till', email: 'till-kpi@example.com', password: PASSWORD, role: 'cashier' });
    expect(cashier.status).toBe(201);

    const cashierToken = await signIn('till-kpi@example.com');
    await request(app).get('/api/analytics/kpis').set('Authorization', `Bearer ${cashierToken}`).expect(403);
  });
});

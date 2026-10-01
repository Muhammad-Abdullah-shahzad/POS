/**
 * The dashboard's daily view: today so far, compared with yesterday up to the
 * same time of day. Later yesterday, and earlier days, are left out.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Order from '../models/Order';
import { kpiWindows } from '../services/kpiService';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const order = (createdAt: Date, total: number, paymentMethod: string) => ({
  invoiceId: `${createdAt.getTime()}-${Math.random()}`,
  items: [{ name: 'Item', quantity: 1, price: total, vatRate: 0, vatAmount: 0, totalPrice: total }],
  subtotal: total,
  totalVAT: 0,
  discount: 0,
  total,
  paymentMethod,
  createdAt,
});

describe('daily dashboard KPIs', () => {
  let token = '';
  const now = new Date();
  const day = kpiWindows(now, 'day');
  const lateYesterday = new Date(day.previousTo.getTime() + 60_000);
  // Close to midnight "a minute after this time yesterday" is already today; that case is not checked.
  const canCheckLateYesterday = lateYesterday < day.currentFrom;

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Daily Shop', contactEmail: 'daily@example.com' }, admin: { name: 'Owner', email: 'daily@example.com', password: PASSWORD } });
    token = (await request(app).post('/api/auth/login').send({ email: 'daily@example.com', password: PASSWORD })).body.data.accessToken;

    await runAsTenant(company.body.data.tenant.id, async () => {
      await Order.create([
        order(new Date(day.currentFrom.getTime() + 1000), 25, 'cash'), // today
        order(new Date(day.previousFrom.getTime() + 1000), 10, 'card'), // early yesterday
        ...(canCheckLateYesterday ? [order(lateYesterday, 7, 'cash')] : []), // yesterday, after this time
        order(new Date(day.previousFrom.getTime() - 3_600_000), 99, 'cash'), // the day before
      ]);
    });
  });

  it('reports today so far against yesterday up to the same time', async () => {
    const response = await request(app).get('/api/analytics/kpis?period=day').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const { current, previous, periods } = response.body.data;

    expect(periods.period).toBe('day');
    expect(new Date(periods.currentFrom).getTime()).toBe(day.currentFrom.getTime());
    expect(current).toMatchObject({ sales: 25, orders: 1, cash: 25, card: 0 });
    expect(previous).toMatchObject({ sales: 10, orders: 1, card: 10 });
  });

  it('still reports the month when asked, or by default', async () => {
    const monthly = (await request(app).get('/api/analytics/kpis?period=month').set('Authorization', `Bearer ${token}`)).body.data;
    const byDefault = (await request(app).get('/api/analytics/kpis').set('Authorization', `Bearer ${token}`)).body.data;
    expect(monthly.periods.period).toBe('month');
    expect(byDefault.periods.period).toBe('month');
    expect(new Date(monthly.periods.currentFrom).getDate()).toBe(1);
  });

  it('refuses an unknown period', async () => {
    const response = await request(app).get('/api/analytics/kpis?period=week').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(422);
  });
});

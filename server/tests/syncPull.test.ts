/**
 * A till's pull compares its rows against the server's list to find records
 * deleted on the web, so that list must be complete: every record, uncapped,
 * including voided sales, and an empty list once everything is deleted.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Order from '../models/Order';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const onboard = async (company: string, email: string) => {
  const created = await request(app)
    .post('/api/platform/tenants')
    .set('x-platform-key', env.platformApiKey)
    .send({ company: { name: company, contactEmail: email }, admin: { name: 'Owner', email, password: PASSWORD } });
  const token = (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.data.accessToken as string;
  return { tenantId: created.body.data.tenant.id as string, token };
};

const sale = (n: number, extra: Record<string, unknown> = {}) => ({
  invoiceId: `S-${n}`,
  items: [{ name: 'Item', quantity: 1, price: 1, vatRate: 0, vatAmount: 0, totalPrice: 1 }],
  subtotal: 1,
  totalVAT: 0,
  discount: 0,
  total: 1,
  paymentMethod: 'cash',
  ...extra,
});

describe('till pull endpoint', () => {
  let shop = { tenantId: '', token: '' };
  let other = { tenantId: '', token: '' };

  const pull = (token: string, collection: string) =>
    request(app).get(`/api/sync/pull/${collection}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    await resetDatabase();
    shop = await onboard('Pull Shop', 'pull@example.com');
    other = await onboard('Other Shop', 'other@example.com');
  });

  it('returns every sale, beyond the 200 the ordinary list shows, including voided ones', async () => {
    await runAsTenant(shop.tenantId, () =>
      Order.create([...Array.from({ length: 249 }, (_, n) => sale(n)), sale(999, { status: 'voided' })])
    );

    const response = await pull(shop.token, 'orders');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(250);
    expect(response.body.data.some((o: any) => o.status === 'voided')).toBe(true);
  });

  it('returns an empty list once the last category is deleted on the web', async () => {
    const created = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${shop.token}`)
      .send({ name: '10mm' });
    expect((await pull(shop.token, 'categories')).body.data).toHaveLength(1);

    await request(app).delete(`/api/categories/${created.body.data._id}`).set('Authorization', `Bearer ${shop.token}`);

    const response = await pull(shop.token, 'categories');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("never returns another company's records", async () => {
    expect((await pull(other.token, 'orders')).body.data).toEqual([]);
  });

  it('serves collections whose path has a slash', async () => {
    expect((await pull(shop.token, 'banks/names')).status).toBe(200);
  });
});

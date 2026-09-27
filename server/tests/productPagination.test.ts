/**
 * The products screen loads the catalogue a page at a time, so a shop with
 * thousands of products never downloads them all at once.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { runAsTenant } from '../core/tenantContext';
import Product from '../models/Product';
import { createCompany, resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const signIn = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.data.accessToken as string;

const product = (name: string, barcode: string) => ({
  name,
  barcode,
  category: 'Pipes',
  price: 10,
  vatRate: 0,
  vatType: 'inclusive' as const,
  costPrice: 5,
  stock: 1,
});

describe('products, a page at a time', () => {
  let alpha = '';
  let beta = '';

  const list = (token: string, query: Record<string, string | number>) =>
    request(app).get('/api/products').query(query).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    await resetDatabase();
    const [a, b] = await Promise.all([createCompany('Alpha Pipes'), createCompany('Beta Pipes')]);

    // 30 pipes and 2 valves for Alpha, all with distinct names; 3 pipes for Beta.
    const alphaProducts = [
      ...Array.from({ length: 30 }, (_, i) => product(`Pipe ${String(i + 1).padStart(2, '0')}`, `A-PIPE-${i}`)),
      product('Valve Large', 'A-VALVE-1'),
      product('Valve Small', 'A-VALVE-2'),
    ];
    await runAsTenant(a.tenant._id.toString(), () => Product.insertMany(alphaProducts));
    await runAsTenant(b.tenant._id.toString(), () =>
      Product.insertMany([product('Pipe 01', 'B-1'), product('Pipe 02', 'B-2'), product('Pipe 03', 'B-3')])
    );

    [alpha, beta] = await Promise.all([signIn(a.admin.email), signIn(b.admin.email)]);
  });

  it('returns one page with the totals needed for page controls', async () => {
    const response = await list(alpha, { page: 1, pageSize: 25 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ total: 32, page: 1, pageSize: 25, pageCount: 2 });
    expect(response.body.data.items).toHaveLength(25);
    expect(response.body.data.items[0].name).toBe('Pipe 01');
  });

  it('never repeats or skips a product between pages', async () => {
    const first = (await list(alpha, { page: 1, pageSize: 25 })).body.data.items;
    const second = (await list(alpha, { page: 2, pageSize: 25 })).body.data.items;
    const names = [...first, ...second].map((item: { name: string }) => item.name);

    expect(second).toHaveLength(7);
    expect(new Set(names).size).toBe(32);
  });

  it('searches across the whole catalogue, not just the current page', async () => {
    const response = await list(alpha, { page: 1, pageSize: 25, search: 'valve' });

    expect(response.body.data).toMatchObject({ total: 2, pageCount: 1 });
    expect(response.body.data.items.map((item: { name: string }) => item.name)).toEqual(['Valve Large', 'Valve Small']);
  });

  it("counts only the company's own products", async () => {
    const response = await list(beta, { page: 1 });

    expect(response.body.data).toMatchObject({ total: 3, pageSize: 25, pageCount: 1 });
  });

  it('gives an empty page past the end, with the real totals', async () => {
    const response = await list(beta, { page: 9 });

    expect(response.body.data.items).toEqual([]);
    expect(response.body.data).toMatchObject({ total: 3, pageCount: 1 });
  });

  it('refuses pages too large to be worth paging', async () => {
    await list(alpha, { page: 1, pageSize: 1000 }).expect(422);
    await list(alpha, { page: 0 }).expect(422);
  });

  it('still returns a plain list for the till search, which asks for no page', async () => {
    const response = await list(alpha, { search: 'pipe', limit: 5 });

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(5);
  });
});

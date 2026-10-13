/**
 * The till's product search lists the best matches first: a name starting
 * with the query, then a word in the name starting with it, and only when
 * neither exists, the query anywhere in the name.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import Product from '../models/Product';
import { createCompany, resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

describe('till product search', () => {
  let token = '';
  const search = async (term: string) =>
    ((await request(app).get('/api/products').query({ search: term }).set('Authorization', `Bearer ${token}`)).body.data as any[]).map((p) => p.name);

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Search Shop', contactEmail: 'search@example.com' }, admin: { name: 'Owner', email: 'search@example.com', password: PASSWORD } });
    token = (await request(app).post('/api/auth/login').send({ email: 'search@example.com', password: PASSWORD })).body.data.accessToken;

    const names = [
      '1-1/2"x10" Pipe Nipple M Quality Tahir & Sons',
      '1-1/2"x24" Pipe Nipple M Quality Tahir & Sons',
      '1/2"x3" Pipe Nipple M Quality Tahir & Sons',
      '1/2"x24" Pipe Nipple M Quality Tahir & Sons',
      '25mm Socket Duraflow',
      '25x1/2" Female Threaded Socket Duraflow',
    ];
    await runAsTenant(company.body.data.tenant.id, () =>
      Product.create(names.map((name, i) => ({ name, barcode: `B${i}`, category: 'Pipes', price: 1, costPrice: 0, vatRate: 0, vatType: 'exclusive' as const, stock: 0 })))
    );
  });

  it('lists sizes that start with the query, not larger sizes that contain it', async () => {
    // Sizes in numeric order: 3" before 24".
    expect(await search('1/2"x')).toEqual(['1/2"x3" Pipe Nipple M Quality Tahir & Sons', '1/2"x24" Pipe Nipple M Quality Tahir & Sons']);
    expect(await search('1-1/2')).toEqual(['1-1/2"x10" Pipe Nipple M Quality Tahir & Sons', '1-1/2"x24" Pipe Nipple M Quality Tahir & Sons']);
  });

  it('finds a word inside the name, names starting with the query first', async () => {
    expect(await search('socket')).toEqual(['25mm Socket Duraflow', '25x1/2" Female Threaded Socket Duraflow']);
    expect(await search('25')).toEqual(['25mm Socket Duraflow', '25x1/2" Female Threaded Socket Duraflow']);
  });

  it('falls back to the query anywhere when nothing starts with it', async () => {
    expect(await search('x24')).toEqual(['1-1/2"x24" Pipe Nipple M Quality Tahir & Sons', '1/2"x24" Pipe Nipple M Quality Tahir & Sons']);
  });

  it('finds a product by the start of its barcode', async () => {
    expect(await search('B4')).toEqual(['25mm Socket Duraflow']);
  });
});

describe('smart search through the API (till and products screen)', () => {
  let token = '';
  const get = (query: Record<string, string | number>) =>
    request(app).get('/api/products').query(query).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const shop = await createCompany('Haji Smart Search');
    const names = [
      '1 1/2" Bend 90d, 45d (Grey) Popular',
      '1 1/2" Bend Long Radius (Grey) Popular',
      '1/2" Bend 90d, 45d (Grey) Popular',
      '25mm Clamp Duraflow',
    ];
    await runAsTenant(shop.tenant._id.toString(), () =>
      Product.create(names.map((name, i) => ({ name, barcode: `HS${i}`, category: 'Fittings', price: 1, costPrice: 0, vatRate: 0, vatType: 'exclusive' as const, stock: 0 })))
    );
    token = (await request(app).post('/api/auth/login').send({ email: shop.admin.email, password: PASSWORD })).body.data.accessToken;
  });

  it('the till finds "1 1/2 grey 40d", similar products after it, never another size', async () => {
    const found = ((await get({ search: '1 1/2 grey 40d' })).body.data as any[]).map((p) => p.name);
    expect(found).toEqual(['1 1/2" Bend 90d, 45d (Grey) Popular', '1 1/2" Bend Long Radius (Grey) Popular']);
  });

  it('the products screen pages the same ranked matches', async () => {
    const response = await get({ search: 'grey bend', page: 1, pageSize: 2 });
    expect(response.body.data).toMatchObject({ total: 3, pageCount: 2 });
    expect(response.body.data.items).toHaveLength(2);
    const next = await get({ search: 'grey bend', page: 2, pageSize: 2 });
    expect(next.body.data.items).toHaveLength(1);
  });
});

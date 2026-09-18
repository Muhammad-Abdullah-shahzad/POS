/**
 * End to end checks over HTTP: onboarding, sign in, session rotation and the
 * isolation guarantee as an attacker would actually probe it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { resetDatabase } from './helpers';

const app = createApp();

const onboard = (company: string, email: string) =>
  request(app)
    .post('/api/platform/tenants')
    .set('x-platform-key', env.platformApiKey)
    .send({
      company: { name: company, contactEmail: email },
      admin: { name: 'Owner', email, password: 'correct horse battery' },
    });

const signIn = (email: string) =>
  request(app).post('/api/auth/login').send({ email, password: 'correct horse battery' });

describe('API', () => {
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    await resetDatabase();

    await onboard('Alpha Store', 'alpha@example.com').expect(201);
    await onboard('Beta Store', 'beta@example.com').expect(201);

    tokenA = (await signIn('alpha@example.com').expect(200)).body.data.accessToken;
    tokenB = (await signIn('beta@example.com').expect(200)).body.data.accessToken;
  });

  describe('onboarding', () => {
    it('refuses without the platform key', async () => {
      const response = await request(app)
        .post('/api/platform/tenants')
        .send({
          company: { name: 'Sneaky', contactEmail: 'sneaky@example.com' },
          admin: { name: 'X', email: 'sneaky@example.com', password: 'correct horse battery' },
        });

      expect(response.status).toBe(401);
    });

    it('gives the new company a working settings document', async () => {
      const response = await request(app).get('/api/settings').set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shopName).toBe('Alpha Store');
    });

    it('rejects a second company reusing an email', async () => {
      const response = await onboard('Alpha Clone', 'alpha@example.com');
      expect(response.status).toBe(409);
    });
  });

  describe('authentication', () => {
    it('rejects a wrong password with the same message as an unknown email', async () => {
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alpha@example.com', password: 'not the password' });
      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'not the password' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('rejects a request with no token', async () => {
      await request(app).get('/api/products').expect(401);
    });

    it('reports the signed in company', async () => {
      const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenA}`);

      expect(response.body.data.tenantName).toBe('Alpha Store');
      expect(response.body.data.role).toBe('admin');
    });

    it('rotates the refresh token and refuses the old one', async () => {
      const first = await signIn('alpha@example.com').expect(200);
      const original = first.body.data.refreshToken;

      const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: original });
      expect(rotated.status).toBe(200);
      expect(rotated.body.data.refreshToken).not.toBe(original);

      // Presenting the spent token looks like theft, so it is refused.
      const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: original });
      expect(replay.status).toBe(401);
    });
  });

  describe('data isolation', () => {
    let alphaProductId = '';

    beforeAll(async () => {
      const created = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Alpha Milk',
          barcode: '1001',
          category: 'Dairy',
          price: 2,
          costPrice: 1,
          vatRate: 0,
          stock: 10,
        });

      expect(created.status).toBe(201);
      alphaProductId = created.body.data._id;
    });

    it('does not list another company products', async () => {
      const response = await request(app).get('/api/products').set('Authorization', `Bearer ${tokenB}`);

      expect(response.body.data).toEqual([]);
    });

    it('does not expose another company product by id', async () => {
      const response = await request(app)
        .patch(`/api/products/${alphaProductId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ price: 9999 });

      expect(response.status).toBe(404);
    });

    it('does not find another company product by barcode', async () => {
      const response = await request(app)
        .get('/api/products/barcode/1001')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(response.status).toBe(404);
    });

    it('lets both companies use the same barcode', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Beta Milk', barcode: '1001', category: 'Dairy', price: 3, costPrice: 1, vatRate: 0, stock: 4 });

      expect(response.status).toBe(201);
    });

    it('keeps sales and receipt numbers separate', async () => {
      const sale = (token: string, name: string) =>
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{ name, quantity: 1, price: 2, vatRate: 0, vatAmount: 0, totalPrice: 2 }],
            subtotal: 2,
            totalVAT: 0,
            total: 2,
            paymentMethod: 'cash',
          });

      const alphaSale = await sale(tokenA, 'Alpha Milk');
      const betaSale = await sale(tokenB, 'Beta Milk');

      // Each company counts its own receipts from one.
      expect(alphaSale.body.data.invoiceId).toBe('1');
      expect(betaSale.body.data.invoiceId).toBe('1');

      const alphaOrders = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
      expect(alphaOrders.body.data).toHaveLength(1);
    });
  });

  describe('voiding', () => {
    it('voids with query parameters, returns stock, and refuses a second void', async () => {
      const product = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Void Test', barcode: 'void-1', category: 'Misc', price: 1, costPrice: 1, vatRate: 0, stock: 5 });

      const sale = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ product: product.body.data._id, name: 'Void Test', quantity: 2, price: 1, totalPrice: 2 }],
          subtotal: 2,
          totalVAT: 0,
          total: 2,
          paymentMethod: 'cash',
        })
        .expect(201);

      const voided = await request(app)
        .delete(`/api/orders/${sale.body.data._id}?reason=Customer%20changed%20mind`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(voided.status).toBe(200);
      expect(voided.body.data.voidReason).toBe('Customer changed mind');

      const restocked = await request(app)
        .get('/api/products/barcode/void-1')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(restocked.body.data.stock).toBe(5);

      await request(app)
        .delete(`/api/orders/${sale.body.data._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });

    it('cannot void another company order', async () => {
      const sale = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ items: [{ name: 'Loose item', quantity: 1, price: 1, totalPrice: 1 }], subtotal: 1, totalVAT: 0, total: 1, paymentMethod: 'cash' })
        .expect(201);

      await request(app)
        .delete(`/api/orders/${sale.body.data._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe('validation and permissions', () => {
    it('rejects a product with no barcode', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Nameless', category: 'Dairy' });

      expect(response.status).toBe(422);
      expect(response.body.details).toBeDefined();
    });

    it('stops a cashier from managing staff accounts', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Till One', email: 'till@alpha.example.com', password: 'correct horse battery', role: 'cashier' })
        .expect(201);

      const cashierToken = (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'till@alpha.example.com', password: 'correct horse battery' })
      ).body.data.accessToken;

      await request(app).get('/api/users').set('Authorization', `Bearer ${cashierToken}`).expect(403);
    });

    it('refuses to sell more stock than is on hand', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          items: [
            {
              product: (
                await request(app).get('/api/products').set('Authorization', `Bearer ${tokenB}`)
              ).body.data[0]._id,
              name: 'Beta Milk',
              quantity: 999,
              price: 3,
              vatRate: 0,
              vatAmount: 0,
              totalPrice: 2997,
            },
          ],
          subtotal: 2997,
          totalVAT: 0,
          total: 2997,
          paymentMethod: 'cash',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/not enough stock/i);
    });
  });
});

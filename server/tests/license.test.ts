/**
 * Licensing: self sign up, the operator issuing and extending keys, the
 * lock that follows an expiry, and what a customer can and cannot activate.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { addMonths, signLicenseKey, verifyLicenseKey } from '../core/license';
import { withSystemScope } from '../core/tenantContext';
import { invalidateTenantCache } from '../core/tenantStatusCache';
import Tenant from '../models/Tenant';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const registerCompany = (companyName: string, email: string) =>
  request(app).post('/api/auth/register').send({ companyName, name: 'Owner', email, password: PASSWORD });

const signIn = (email: string) => request(app).post('/api/auth/login').send({ email, password: PASSWORD });

const platform = () => ({ 'x-platform-key': env.platformApiKey });

/** Move a company's licence expiry, bypassing the cache, to simulate time passing. */
async function setExpiry(tenantId: string, expiresAt: Date): Promise<void> {
  await withSystemScope(() => Tenant.updateOne({ _id: tenantId }, { $set: { 'license.expiresAt': expiresAt } }));
  invalidateTenantCache(tenantId);
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('licensing', () => {
  let token = '';
  let tenantId = '';

  beforeAll(async () => {
    await resetDatabase();

    const registered = await registerCompany('Delta Store', 'delta@example.com');
    expect(registered.status).toBe(201);

    token = registered.body.data.accessToken;
    tenantId = registered.body.data.user.tenantId;
  });

  describe('key format', () => {
    it('round trips claims through a signed key', () => {
      const expiresAt = new Date('2030-01-31T00:00:00Z');
      const key = signLicenseKey(
        { tenantId: 'abc', licenseId: 'lic', issuedAt: new Date('2029-12-31T00:00:00Z'), expiresAt },
        env.license.signingKey
      );

      const claims = verifyLicenseKey(key, env.license.publicKey);
      expect(claims.tenantId).toBe('abc');
      expect(claims.expiresAt.getTime()).toBe(expiresAt.getTime());
    });

    it('rejects a key whose payload was edited', () => {
      const key = signLicenseKey(
        { tenantId: 'abc', licenseId: 'lic', issuedAt: new Date(), expiresAt: new Date() },
        env.license.signingKey
      );
      const [prefix, payload, signature] = key.split('.');
      const forged = Buffer.from(JSON.stringify({ t: 'abc', k: 'lic', i: 0, e: 4102444800 })).toString('base64url');

      expect(() => verifyLicenseKey(`${prefix}.${forged}.${signature}`, env.license.publicKey)).toThrow(/genuine/);
      expect(() => verifyLicenseKey(`${prefix}.${payload}`, env.license.publicKey)).toThrow(/not a valid/);
    });

    it('adds months without spilling into the following month', () => {
      expect(addMonths(new Date('2030-01-31T12:00:00Z'), 1).toISOString()).toBe('2030-02-28T12:00:00.000Z');
      expect(addMonths(new Date('2030-03-15T00:00:00Z'), 12).toISOString()).toBe('2031-03-15T00:00:00.000Z');
    });
  });

  describe('sign up', () => {
    it('starts a new company on a trial and lets it work straight away', async () => {
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(me.body.data.license.state).toBe('active');
      expect(me.body.data.license.kind).toBe('trial');

      const products = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);
      expect(products.status).toBe(200);
    });

    it('refuses an email that already has an account', async () => {
      const response = await registerCompany('Delta Clone', 'delta@example.com');
      expect(response.status).toBe(409);
    });

    it('validates the form', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ companyName: '', name: 'X', email: 'not-an-email', password: 'short' });
      expect(response.status).toBe(422);
    });
  });

  describe('operator issuing keys', () => {
    it('lists companies with their licence', async () => {
      const response = await request(app).get('/api/platform/tenants').set(platform());

      expect(response.status).toBe(200);
      const delta = response.body.data.find((tenant: { id: string }) => tenant.id === tenantId);
      expect(delta.license.state).toBe('active');
      expect(delta.status).toBe('trial');
    });

    it('issues a paid month that starts when the trial ends, and ends the trial status', async () => {
      const before = await request(app).get(`/api/platform/tenants/${tenantId}/license`).set(platform());
      const trialEnd = new Date(before.body.data.expiresAt);

      const issued = await request(app)
        .post(`/api/platform/tenants/${tenantId}/license`)
        .set(platform())
        .send({ months: 1, note: 'first invoice' });

      expect(issued.status).toBe(201);
      expect(issued.body.data.tenant.status).toBe('active');
      expect(issued.body.data.license.kind).toBe('paid');
      expect(new Date(issued.body.data.license.expiresAt).getTime()).toBe(addMonths(trialEnd, 1).getTime());

      const claims = verifyLicenseKey(issued.body.data.license.key, env.license.publicKey);
      expect(claims.tenantId).toBe(tenantId);
    });

    it('keeps the licence id across an extension and records the history', async () => {
      const first = await request(app).get(`/api/platform/tenants/${tenantId}/license`).set(platform());
      const extended = await request(app)
        .post(`/api/platform/tenants/${tenantId}/license`)
        .set(platform())
        .send({ months: 1 });

      const previous = verifyLicenseKey(first.body.data.key, env.license.publicKey);
      const next = verifyLicenseKey(extended.body.data.license.key, env.license.publicKey);
      expect(next.licenseId).toBe(previous.licenseId);
      expect(next.expiresAt.getTime()).toBe(addMonths(previous.expiresAt, 1).getTime());

      const tenant = await withSystemScope(() => Tenant.findById(tenantId).lean());
      expect(tenant?.licenseHistory.length).toBeGreaterThanOrEqual(2);
    });

    it('refuses without the platform key', async () => {
      const response = await request(app).post(`/api/platform/tenants/${tenantId}/license`).send({ months: 1 });
      expect(response.status).toBe(401);
    });
  });

  describe('an expired licence', () => {
    beforeAll(async () => {
      await setExpiry(tenantId, new Date(Date.now() - DAY_MS));
    });

    it('locks the data endpoints with 402', async () => {
      const response = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(402);
      expect(response.body.code).toBe('LICENSE_EXPIRED');
    });

    it('still allows sign in, so the renewal screen can be shown', async () => {
      const response = await signIn('delta@example.com');

      expect(response.status).toBe(200);
      expect(response.body.data.license.state).toBe('expired');
    });

    it('still reports the licence status', async () => {
      const response = await request(app).get('/api/license').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.state).toBe('expired');
      expect(response.body.data.daysLeft).toBeLessThan(0);
    });

    it('rejects a forged key', async () => {
      const response = await request(app)
        .post('/api/license/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ key: 'POS1.eyJ0IjoieCJ9.bm90LWEtc2lnbmF0dXJl' });

      expect(response.status).toBe(422);
      expect(response.body.code).toBe('LICENSE_KEY_INVALID');
    });

    it('rejects a key issued to another company', async () => {
      const other = await registerCompany('Echo Store', 'echo@example.com');
      const otherKey = other.body.data.license.key;

      const response = await request(app)
        .post('/api/license/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ key: otherKey });

      expect(response.status).toBe(422);
      expect(response.body.message).toMatch(/different company/);
    });

    it('unlocks when the customer pastes a genuine key', async () => {
      // The operator issues a key out of band; the pasted copy has whitespace
      // from an email client.
      const key = signLicenseKey(
        {
          tenantId,
          licenseId: 'renewal',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * DAY_MS),
        },
        env.license.signingKey
      );
      const pasted = `${key.slice(0, 40)}\n ${key.slice(40)} `;

      const activated = await request(app)
        .post('/api/license/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ key: pasted });

      expect(activated.status).toBe(200);
      expect(activated.body.data.state).toBe('active');

      const products = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);
      expect(products.status).toBe(200);
    });

    it('refuses a key that would shorten the licence already in force', async () => {
      const shorter = signLicenseKey(
        { tenantId, licenseId: 'renewal', issuedAt: new Date(), expiresAt: new Date(Date.now() + 5 * DAY_MS) },
        env.license.signingKey
      );

      const response = await request(app)
        .post('/api/license/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ key: shorter });

      expect(response.status).toBe(422);
    });
  });

  describe('a company with no licence at all', () => {
    it('is locked until the operator issues one', async () => {
      const onboarded = await request(app)
        .post('/api/platform/tenants')
        .set(platform())
        .send({
          company: { name: 'Foxtrot', contactEmail: 'foxtrot@example.com' },
          admin: { name: 'Owner', email: 'foxtrot@example.com', password: PASSWORD },
          license: null,
        });
      expect(onboarded.status).toBe(201);
      expect(onboarded.body.data.tenant.license.state).toBe('missing');

      const session = await signIn('foxtrot@example.com');
      const locked = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${session.body.data.accessToken}`);

      expect(locked.status).toBe(402);
      expect(locked.body.code).toBe('LICENSE_MISSING');
    });
  });
});

/**
 * Which sync buttons a company's desktop tills show is set by the operator
 * on the company record (scripts/setDesktopButtons). The company sees it
 * read-only in its settings, which is where tills read it, but can never
 * change it: not through its settings, and not through a till's sync.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import Tenant from '../models/Tenant';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';
const SLUG = 'button-shop';

describe('desktop button settings', () => {
  let token = '';
  const get = async () => (await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`)).body.data;

  beforeAll(async () => {
    await resetDatabase();
    await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Button Shop', slug: SLUG, contactEmail: 'buttons@example.com' }, admin: { name: 'Owner', email: 'buttons@example.com', password: PASSWORD } });
    token = (await request(app).post('/api/auth/login').send({ email: 'buttons@example.com', password: PASSWORD })).body.data.accessToken;
  });

  it('shows both buttons by default', async () => {
    expect((await get()).desktopBtnSettings).toEqual({ showSyncBtn: 'SHOW_SYNC_BTNS', showPullBtn: 'SHOW_SYNC_BTNS' });
  });

  it('reaches the tills once the operator changes it on the company record', async () => {
    await Tenant.updateOne({ slug: SLUG }, { $set: { 'desktopBtnSettings.showPullBtn': 'HIDE_SYNC_BTNS' } });
    expect((await get()).desktopBtnSettings).toEqual({ showSyncBtn: 'SHOW_SYNC_BTNS', showPullBtn: 'HIDE_SYNC_BTNS' });
  });

  it("cannot be changed through the company's own settings", async () => {
    const response = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ shopName: 'Renamed shop', desktopBtnSettings: { showSyncBtn: 'SHOW_SYNC_BTNS', showPullBtn: 'SHOW_SYNC_BTNS' } });
    expect(response.status).toBe(200);
    expect(response.body.data.shopName).toBe('Renamed shop');
    expect((await get()).desktopBtnSettings.showPullBtn).toBe('HIDE_SYNC_BTNS');
  });

  it("files a till's settings into the company's one settings record, whatever id the till used", async () => {
    const before = await get();
    const push = await request(app)
      .post('/api/settings/sync')
      .set('Authorization', `Bearer ${token}`)
      .send([{ _id: '6acb3141e88e359fce632901', receiptFooter: 'Thank you, visit again', receiptSize: 'A4' }]);
    expect(push.status).toBe(200);
    expect(push.body.data.errors).toEqual([]);

    const after = await get();
    expect(after._id).toBe(before._id);
    expect(after).toMatchObject({ receiptFooter: 'Thank you, visit again', receiptSize: 'A4' });
  });

  it("cannot be changed by a till's sync", async () => {
    const settings = await get();
    await request(app)
      .post('/api/settings/sync')
      .set('Authorization', `Bearer ${token}`)
      .send([{ _id: settings._id, shopName: 'Renamed on the till', desktopBtnSettings: { showSyncBtn: 'SHOW_SYNC_BTNS', showPullBtn: 'SHOW_SYNC_BTNS' } }]);

    const after = await get();
    expect(after.shopName).toBe('Renamed on the till');
    expect(after.desktopBtnSettings.showPullBtn).toBe('HIDE_SYNC_BTNS');
  });
});

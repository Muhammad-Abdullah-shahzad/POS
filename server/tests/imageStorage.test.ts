/**
 * Images live on Google Drive, never on the server disk: uploads, replacements,
 * removals, photos desktop tills send inline during sync, and serving them
 * back to browsers. Drive itself is replaced by an in-memory fake, so the
 * tests never touch a real account.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../app';
import { runAsTenant, withSystemScope } from '../core/tenantContext';
import CompanyLogo from '../models/CompanyLogo';
import Product from '../models/Product';
import { setCompanyLogo } from '../services/companyLogoService';
import { createCompany, resetDatabase } from './helpers';

// ── A fake Drive: files kept in a map, links in Drive's real format ───────
// Files the app uploaded are "ours": in its own folders, so the server serves them.
const drive = vi.hoisted(() => ({ files: new Map<string, string>(), ours: new Set<string>(), nextId: 0, downloads: 0 }));

vi.mock('../utils/googleDrive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/googleDrive')>();
  return {
    ...actual,
    isDriveConfigured: () => true,
    uploadToDrive: vi.fn(async ({ fileName }: { fileName: string }) => {
      drive.nextId += 1;
      const fileId = `drivefile${drive.nextId}`;
      drive.files.set(fileId, fileName);
      drive.ours.add(fileId);
      return { fileId, url: actual.driveImageUrl(fileId) };
    }),
    downloadDriveImage: vi.fn(async (fileId: string) => {
      if (!drive.files.has(fileId) || !drive.ours.has(fileId)) return null;
      drive.downloads += 1;
      return { data: Buffer.from(`image bytes of ${drive.files.get(fileId)}`), mimeType: 'image/png' };
    }),
    deleteFromDrive: vi.fn(async (fileId: string) => {
      drive.files.delete(fileId);
    }),
  };
});

const app = createApp();
const PASSWORD = 'correct horse battery';
// A tiny valid PNG, sent as a real image file.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const DATA_URL = `data:image/png;base64,${PNG.toString('base64')}`;

const signIn = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.data.accessToken as string;
const driveId = (url: string) => url.match(/[?&]id=([\w-]+)/)?.[1] ?? '';
const onDrive = (url: string) => drive.files.has(driveId(url));

describe('image storage on Google Drive', () => {
  let company: Awaited<ReturnType<typeof createCompany>>;
  let tenantId = '';
  let admin = '';
  let cashier = '';
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await resetDatabase();
    company = await createCompany('Delta Pipes');
    tenantId = company.tenant._id.toString();
    admin = await signIn(company.admin.email);
    await request(app)
      .post('/api/users')
      .set(as(admin))
      .send({ name: 'Till', email: 'till-images@example.com', password: PASSWORD, role: 'cashier' })
      .expect(201);
    cashier = await signIn('till-images@example.com');
  });

  beforeEach(() => {
    fs.rmSync(path.join(process.cwd(), 'uploads', 'logos', tenantId), { recursive: true, force: true });
  });

  describe('company logo', () => {
    const upload = (token: string, file = PNG, name = 'logo.png') =>
      request(app).post('/api/company-logo').set(as(token)).attach('logo', file, name);

    it('uploads to Drive and saves only the link', async () => {
      const response = await upload(admin);

      expect(response.status).toBe(201);
      expect(response.body.data.url).toMatch(/^https:\/\/drive\.google\.com\/thumbnail\?id=/);
      expect(onDrive(response.body.data.url)).toBe(true);
      expect(fs.existsSync(path.join(process.cwd(), 'uploads', 'logos', tenantId))).toBe(false);

      const stored = await withSystemScope(() => CompanyLogo.findOne({ slug: company.tenant.slug }));
      expect(stored).toMatchObject({ url: response.body.data.url, source: 'upload' });
    });

    it('deletes the old file from Drive when replaced', async () => {
      const before = (await request(app).get('/api/company-logo').set(as(admin))).body.data.url;
      const after = (await upload(admin)).body.data.url;

      expect(after).not.toBe(before);
      expect(onDrive(before)).toBe(false);
      expect(onDrive(after)).toBe(true);
    });

    it('refuses anything that is not an image', async () => {
      await upload(admin, Buffer.from('not an image'), 'notes.txt').expect(400);
    });

    it('only lets the admin change it', async () => {
      await upload(cashier).expect(403);
      await request(app).delete('/api/company-logo').set(as(cashier)).expect(403);
    });

    it('removes the logo and its Drive file', async () => {
      const url = (await request(app).get('/api/company-logo').set(as(admin))).body.data.url;
      await request(app).delete('/api/company-logo').set(as(admin)).expect(200);

      expect((await request(app).get('/api/company-logo').set(as(admin))).body.data).toBeNull();
      expect(onDrive(url)).toBe(false);
    });

    it('never deletes a logo the operator linked from elsewhere', async () => {
      await withSystemScope(() => setCompanyLogo(company.tenant.slug, 'https://drive.google.com/thumbnail?id=operatorfile'));
      drive.files.set('operatorfile', 'operator.png');

      await upload(admin);
      expect(drive.files.has('operatorfile')).toBe(true);
    });
  });

  describe('product photos', () => {
    let productId = '';

    it('stores a new product photo on Drive', async () => {
      const response = await request(app)
        .post('/api/products')
        .set(as(admin))
        .field('name', 'Pump')
        .field('barcode', 'IMG-1')
        .field('category', 'Pumps')
        .field('price', '100')
        .field('costPrice', '60')
        .field('vatRate', '0')
        .field('vatType', 'inclusive')
        .field('stock', '5')
        .attach('image', PNG, 'pump.png');

      expect(response.status).toBe(201);
      expect(response.body.data.image).toMatch(/^https:\/\/drive\.google\.com\/thumbnail\?id=/);
      expect(onDrive(response.body.data.image)).toBe(true);
      productId = response.body.data._id;
    });

    it('replaces the photo and deletes the old one from Drive', async () => {
      const before = (await runAsTenant(tenantId, () => Product.findById(productId)))!.image!;
      const response = await request(app).patch(`/api/products/${productId}`).set(as(admin)).attach('image', PNG, 'pump-2.png');

      expect(response.status).toBe(200);
      expect(onDrive(before)).toBe(false);
      expect(onDrive(response.body.data.image)).toBe(true);
    });

    it('deletes the photo from Drive with the product', async () => {
      const image = (await runAsTenant(tenantId, () => Product.findById(productId)))!.image!;
      await request(app).delete(`/api/products/${productId}`).set(as(admin)).expect(200);
      expect(onDrive(image)).toBe(false);
    });

    it('moves an inline photo from a desktop till to Drive during sync', async () => {
      const localId = '64a0000000000000000000a1';
      const response = await request(app)
        .post('/api/products/sync')
        .set(as(admin))
        .send([{ _id: localId, name: 'Offline Pump', barcode: 'IMG-2', category: 'Pumps', price: 50, costPrice: 30, vatRate: 0, vatType: 'inclusive', stock: 2, image: DATA_URL }]);

      expect(response.status).toBe(200);
      const saved = await runAsTenant(tenantId, () => Product.findById(localId));
      expect(saved!.image).toMatch(/^https:\/\/drive\.google\.com\/thumbnail\?id=/);
      expect(onDrive(saved!.image!)).toBe(true);
    });
  });

  describe('serving images to browsers', () => {
    const image = (fileId: string) => request(app).get(`/api/images/drive/${fileId}`);
    let fileId = '';

    beforeAll(async () => {
      const response = await request(app).post('/api/company-logo').set(as(admin)).attach('logo', PNG, 'logo.png');
      fileId = driveId(response.body.data.url);
    });

    it('serves a stored image without a sign-in, cached by the browser for good', async () => {
      const response = await image(fileId);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['cache-control']).toContain('immutable');
      expect(response.body.toString()).toContain(drive.files.get(fileId));
    });

    it('asks Drive for each image only once', async () => {
      const before = drive.downloads;
      await Promise.all([image(fileId), image(fileId), image(fileId)]);

      expect(drive.downloads).toBe(before);
    });

    it("sends a Drive file that is not the app's own on to Google", async () => {
      drive.files.set('elsewherefile1', 'elsewhere.png');
      const response = await image('elsewherefile1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('https://drive.google.com/thumbnail?id=elsewherefile1&sz=w1000');
    });

    it('refuses anything that is not a Drive file id', async () => {
      await image('..%2F..%2Fetc').expect(404);
      await image('short').expect(404);
    });

    it('stops serving an image once it is deleted', async () => {
      await request(app).delete('/api/company-logo').set(as(admin)).expect(200);

      expect((await image(fileId)).status).toBe(302);
    });
  });

  it('never writes an image to the server disk', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'uploads', 'products', tenantId))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'uploads', 'logos', tenantId))).toBe(false);
  });
});

/**
 * Company logos: set by the operator, read by each company for itself only,
 * and removed when the company is deleted.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { withSystemScope } from '../core/tenantContext';
import CompanyLogo from '../models/CompanyLogo';
import { removeCompanyLogo, setCompanyLogo } from '../services/companyLogoService';
import { deleteTenant } from '../services/tenantDeletionService';
import { createCompany, resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const signIn = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.data.accessToken as string;

describe('company logos', () => {
  let alpha: Awaited<ReturnType<typeof createCompany>>;
  let beta: Awaited<ReturnType<typeof createCompany>>;

  beforeAll(async () => {
    await resetDatabase();
    [alpha, beta] = await Promise.all([createCompany('Alpha Pipes'), createCompany('Beta Pipes')]);
    await withSystemScope(() => setCompanyLogo(alpha.tenant.slug, 'https://cdn.example.com/alpha.png'));
  });

  it('gives a company its own logo', async () => {
    const token = await signIn(alpha.admin.email);
    const response = await request(app).get('/api/company-logo').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ slug: alpha.tenant.slug, url: 'https://cdn.example.com/alpha.png' });
  });

  it("never shows another company's logo", async () => {
    const token = await signIn(beta.admin.email);
    const response = await request(app).get('/api/company-logo').set('Authorization', `Bearer ${token}`);

    expect(response.body.data).toBeNull();
  });

  it('replaces the logo rather than adding a second one', async () => {
    await withSystemScope(() => setCompanyLogo(alpha.tenant.slug, 'https://cdn.example.com/alpha-v2.png'));
    const logos = await withSystemScope(() => CompanyLogo.find({ slug: alpha.tenant.slug }));

    expect(logos).toHaveLength(1);
    expect(logos[0].url).toBe('https://cdn.example.com/alpha-v2.png');
  });

  it('refuses anything that is not a web address', async () => {
    await expect(withSystemScope(() => setCompanyLogo(beta.tenant.slug, 'not a url'))).rejects.toThrow();
    await expect(withSystemScope(() => setCompanyLogo(beta.tenant.slug, 'file:///etc/passwd'))).rejects.toThrow();
  });

  it('removes a logo on request', async () => {
    await withSystemScope(() => setCompanyLogo(beta.tenant.slug, 'https://cdn.example.com/beta.png'));
    expect(await withSystemScope(() => removeCompanyLogo(beta.tenant.slug))).toBe(true);
    expect(await withSystemScope(() => CompanyLogo.countDocuments({ slug: beta.tenant.slug }))).toBe(0);
  });

  it('is deleted along with its company', async () => {
    await deleteTenant(alpha.tenant._id.toString());
    expect(await withSystemScope(() => CompanyLogo.countDocuments({ slug: alpha.tenant.slug }))).toBe(0);
  });
});

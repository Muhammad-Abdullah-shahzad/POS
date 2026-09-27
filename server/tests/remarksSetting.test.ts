/**
 * The "ask for remarks at checkout" setting: on unless a company turns it
 * off, kept per company, and only ever a true/false value.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { createCompany, resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

const signIn = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).body.data.accessToken as string;

describe('remarks prompt setting', () => {
  let alphaToken: string;
  let betaToken: string;

  beforeAll(async () => {
    await resetDatabase();
    const [alpha, beta] = await Promise.all([createCompany('Alpha Pipes'), createCompany('Beta Pipes')]);
    [alphaToken, betaToken] = await Promise.all([signIn(alpha.admin.email), signIn(beta.admin.email)]);
  });

  const getSettings = (token: string) => request(app).get('/api/settings').set('Authorization', `Bearer ${token}`);
  const putSettings = (token: string, body: object) =>
    request(app).put('/api/settings').set('Authorization', `Bearer ${token}`).send(body);

  it('asks for remarks by default', async () => {
    const response = await getSettings(alphaToken);

    expect(response.status).toBe(200);
    expect(response.body.data.showRemarksPrompt).toBe(true);
  });

  it('can be switched off, for that company only', async () => {
    const updated = await putSettings(alphaToken, { showRemarksPrompt: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.showRemarksPrompt).toBe(false);

    expect((await getSettings(alphaToken)).body.data.showRemarksPrompt).toBe(false);
    expect((await getSettings(betaToken)).body.data.showRemarksPrompt).toBe(true);
  });

  it('can be switched back on', async () => {
    await putSettings(alphaToken, { showRemarksPrompt: true });

    expect((await getSettings(alphaToken)).body.data.showRemarksPrompt).toBe(true);
  });

  it('refuses anything other than true or false', async () => {
    const response = await putSettings(alphaToken, { showRemarksPrompt: 'false' });

    expect(response.status).toBe(422);
  });
});

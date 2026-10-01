/**
 * Suppliers and customers have unique names, and a supplier is paid as one
 * account: a payment clears their oldest invoices first and is recorded once.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

describe('supplier ledger and unique names', () => {
  let token = '';

  const api = (method: 'get' | 'post' | 'put', url: string, body?: Record<string, unknown>) => {
    const call = request(app)[method](`/api${url}`).set('Authorization', `Bearer ${token}`);
    return body ? call.send(body) : call;
  };

  const invoice = (supplierName: string, invoiceNo: string, amount: number, date: string, paid = 0) =>
    api('post', '/supplier-invoices', { supplierName, invoiceNo, amount, paid, date });

  beforeAll(async () => {
    await resetDatabase();
    await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Ledger Mart', contactEmail: 'ledger@example.com' }, admin: { name: 'Owner', email: 'ledger@example.com', password: PASSWORD } });
    token = (await request(app).post('/api/auth/login').send({ email: 'ledger@example.com', password: PASSWORD })).body.data.accessToken;
  });

  it('refuses a second supplier with the same name, whatever the case', async () => {
    const first = await api('post', '/suppliers', { name: 'Sufi Oil Mill', contact: '0300', emailId: 'sufi@example.com', address: 'Lahore' });
    expect(first.status).toBe(201);

    const second = await api('post', '/suppliers', { name: '  sufi oil mill ', contact: '0301', emailId: 'other@example.com', address: 'Karachi' });
    expect(second.status).toBe(409);
    expect(second.body.message).toContain('Sufi Oil Mill');
  });

  it('refuses a customer name that is already used, on create and on rename', async () => {
    const aisha = await api('post', '/customers', { name: 'Aisha Siddiqui', contactNum1: '0851' });
    const bilal = await api('post', '/customers', { name: 'Bilal Khan', contactNum1: '0852' });
    expect(aisha.status).toBe(201);
    expect(bilal.status).toBe(201);

    expect((await api('post', '/customers', { name: 'AISHA SIDDIQUI', contactNum1: '0853' })).status).toBe(409);
    expect((await api('put', `/customers/${bilal.body.data._id}`, { name: 'aisha siddiqui' })).status).toBe(409);
    // Keeping its own name is not a clash.
    expect((await api('put', `/customers/${aisha.body.data._id}`, { name: 'Aisha Siddiqui', contactNum1: '0859' })).status).toBe(200);
  });

  it('files an invoice under the saved supplier, whatever spelling was typed', async () => {
    const response = await invoice('SUFI OIL MILL', 'INV-1', 100, '2026-09-01');
    expect(response.status).toBe(201);
    expect(response.body.data.supplierName).toBe('Sufi Oil Mill');
    expect(response.body.data.supplierId).toBeTruthy();
  });

  it('refuses an invoice number that is already recorded, whatever the case or supplier', async () => {
    const again = await invoice('Sufi Oil Mill', ' inv-1 ', 50, '2026-09-02');
    expect(again.status).toBe(409);
    expect(again.body.message).toContain('INV-1');

    const otherSupplier = await invoice('National Foods', 'INV-1', 50, '2026-09-02');
    expect(otherSupplier.status).toBe(409);
  });

  it('pays the oldest invoices first and records the payment once, with its remarks', async () => {
    await invoice('Sufi Oil Mill', 'INV-2', 200, '2026-09-05');
    await invoice('Sufi Oil Mill', 'INV-3', 300, '2026-09-10');

    const response = await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'sufi oil mill', amount: 250, remarks: 'Bank transfer #77' });
    expect(response.status).toBe(200);
    expect(response.body.data.applied).toEqual([
      expect.objectContaining({ invoiceNo: 'INV-1', amount: 100 }),
      expect.objectContaining({ invoiceNo: 'INV-2', amount: 150 }),
    ]);

    const invoices: any[] = (await api('get', '/supplier-invoices')).body.data;
    const byNo = Object.fromEntries(invoices.map((i) => [i.invoiceNo, i]));
    expect(byNo['INV-1'].paid).toBe(100);
    expect(byNo['INV-2'].paid).toBe(150);
    expect(byNo['INV-3'].paid).toBe(0);

    const paymentId = response.body.data.paymentId;
    expect(byNo['INV-1'].payments).toEqual([expect.objectContaining({ amount: 100, remarks: 'Bank transfer #77', paymentId })]);
    expect(byNo['INV-2'].payments).toEqual([expect.objectContaining({ amount: 150, remarks: 'Bank transfer #77', paymentId })]);
  });

  it('refuses to pay a supplier more than they are owed', async () => {
    // Owed: 50 on INV-2 and 300 on INV-3.
    const response = await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Sufi Oil Mill', amount: 351 });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('350.00');
  });

  it('refuses to pay a supplier who is owed nothing', async () => {
    const response = await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Nobody Ltd', amount: 10 });
    expect(response.status).toBe(400);
  });

  it('refuses a customer payment above what the customer owes', async () => {
    const customer = await api('post', '/customers', { name: 'Credit Customer', contactNum1: '0860', openingBalance: 40 });
    const id = customer.body.data._id;

    expect((await api('post', `/customers/${id}/payments`, { amountPaid: 41, paymentMethod: 'cash' })).status).toBe(400);
    // A negative amount is rejected as invalid input before it reaches the account.
    expect((await api('post', `/customers/${id}/payments`, { amountPaid: -5, paymentMethod: 'cash' })).status).toBe(422);
    const ok = await api('post', `/customers/${id}/payments`, { amountPaid: 40, paymentMethod: 'cash', notes: 'Cleared' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.customer.outstandingBalance).toBe(0);
  });
});

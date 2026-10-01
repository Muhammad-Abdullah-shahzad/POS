/**
 * Corrections made from a supplier's ledger statement: invoice amounts and
 * remarks, and payments, which are spread again over the oldest invoices so
 * every invoice's `paid` still equals the sum of its payments.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { runAsTenant } from '../core/tenantContext';
import SupplierInvoice from '../models/SupplierInvoice';
import { respreadPayment } from '../services/supplierLedgerService';
import { resetDatabase } from './helpers';

const app = createApp();
const PASSWORD = 'correct horse battery';

describe('supplier ledger corrections', () => {
  let tenantId = '';
  let token = '';

  const api = (method: 'get' | 'post' | 'patch', url: string, body?: Record<string, unknown>) => {
    const call = request(app)[method](`/api${url}`).set('Authorization', `Bearer ${token}`);
    return body ? call.send(body) : call;
  };
  const invoice = async (invoiceNo: string, amount: number, date: string) =>
    (await api('post', '/supplier-invoices', { supplierName: 'Hafiz Arish', invoiceNo, amount, paid: 0, date })).body.data;
  const byNo = async () =>
    Object.fromEntries(((await api('get', '/supplier-invoices')).body.data as any[]).map((i) => [i.invoiceNo, i]));
  const paidMatchesPayments = (inv: any) =>
    Math.abs(inv.paid - inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0)) < 0.005;

  beforeAll(async () => {
    await resetDatabase();
    const company = await request(app)
      .post('/api/platform/tenants')
      .set('x-platform-key', env.platformApiKey)
      .send({ company: { name: 'Supplier Shop', contactEmail: 'sup@example.com' }, admin: { name: 'Owner', email: 'sup@example.com', password: PASSWORD } });
    tenantId = company.body.data.tenant.id;
    token = (await request(app).post('/api/auth/login').send({ email: 'sup@example.com', password: PASSWORD })).body.data.accessToken;
  });

  beforeEach(async () => {
    await runAsTenant(tenantId, () => SupplierInvoice.deleteMany({}));
  });

  it('records how a supplier was paid', async () => {
    await invoice('A-1', 100, '2026-09-01');
    await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Hafiz Arish', amount: 40, method: 'bank' });
    expect((await byNo())['A-1'].payments[0]).toMatchObject({ amount: 40, method: 'bank' });
  });

  it('corrects an invoice amount and remarks, but never below what was paid on it', async () => {
    const a1 = await invoice('A-1', 100, '2026-09-01');
    await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Hafiz Arish', amount: 60 });

    const ok = await api('patch', `/supplier-invoices/${a1._id}`, { amount: 80, remarks: 'Two cartons returned' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ amount: 80, remarks: 'Two cartons returned', paid: 60 });

    const tooLow = await api('patch', `/supplier-invoices/${a1._id}`, { amount: 50 });
    expect(tooLow.status).toBe(400);
    expect((await byNo())['A-1'].amount).toBe(80);
  });

  it('spreads a corrected payment again over the oldest invoices, keeping its date and remarks', async () => {
    await invoice('A-1', 100, '2026-09-01');
    await invoice('A-2', 200, '2026-09-05');
    await invoice('A-3', 300, '2026-09-10');
    const pay = await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Hafiz Arish', amount: 150, remarks: 'Cheque 77', method: 'cheque' });
    const paymentId = pay.body.data.paymentId;
    const paidAt = (await byNo())['A-1'].payments[0].paidAt;

    // Raised: 100 on A-1, 200 on A-2, 50 on A-3.
    const raised = await api('patch', `/supplier-invoices/payments/${paymentId}`, { amount: 350 });
    expect(raised.status).toBe(200);
    let invoices = await byNo();
    expect([invoices['A-1'].paid, invoices['A-2'].paid, invoices['A-3'].paid]).toEqual([100, 200, 50]);
    expect(invoices['A-3'].payments[0]).toMatchObject({ amount: 50, remarks: 'Cheque 77', method: 'cheque', paymentId, paidAt });
    expect(Object.values(invoices).every(paidMatchesPayments)).toBe(true);

    // Lowered: only A-1 is paid now, and the other invoices lose their shares.
    await api('patch', `/supplier-invoices/payments/${paymentId}`, { amount: 70 });
    invoices = await byNo();
    expect([invoices['A-1'].paid, invoices['A-2'].paid, invoices['A-3'].paid]).toEqual([70, 0, 0]);
    expect(invoices['A-2'].payments).toEqual([]);
    expect(Object.values(invoices).every(paidMatchesPayments)).toBe(true);
  });

  it('refuses a payment correction above what the supplier is owed', async () => {
    await invoice('A-1', 100, '2026-09-01');
    const pay = await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Hafiz Arish', amount: 30 });

    const response = await api('patch', `/supplier-invoices/payments/${pay.body.data.paymentId}`, { amount: 101 });
    expect(response.status).toBe(400);
    expect((await byNo())['A-1'].paid).toBe(30);
  });

  it('changes the remarks and method on every invoice a split payment touched', async () => {
    await invoice('A-1', 100, '2026-09-01');
    await invoice('A-2', 100, '2026-09-05');
    const pay = await api('post', '/supplier-invoices/pay-supplier', { supplierName: 'Hafiz Arish', amount: 150 });

    await api('patch', `/supplier-invoices/payments/${pay.body.data.paymentId}`, { remarks: 'Bank ref 9', method: 'bank' });
    const invoices = await byNo();
    for (const no of ['A-1', 'A-2']) expect(invoices[no].payments[0]).toMatchObject({ remarks: 'Bank ref 9', method: 'bank' });
    expect([invoices['A-1'].paid, invoices['A-2'].paid]).toEqual([100, 50]);
  });

  it('corrects a payment recorded before payments had ids', async () => {
    const a1 = await invoice('A-1', 100, '2026-09-01');
    await runAsTenant(tenantId, () =>
      SupplierInvoice.updateOne({ _id: a1._id }, { $set: { paid: 40, payments: [{ amount: 40, remarks: 'Old', paidAt: new Date('2026-09-02') }] } })
    );

    const response = await api('patch', `/supplier-invoices/${a1._id}/payments/0`, { amount: 25 });
    expect(response.status).toBe(200);
    const fixed = (await byNo())['A-1'];
    expect(fixed.paid).toBe(25);
    expect(fixed.payments[0]).toMatchObject({ amount: 25, remarks: 'Old' });
    expect(fixed.payments[0].paymentId).toBeTruthy();
  });

  it('keeps a corrected payment on the invoices it already covered', async () => {
    await invoice('A-1', 100, '2026-09-01');
    const a2 = await invoice('A-2', 100, '2026-09-05');
    await runAsTenant(tenantId, () =>
      SupplierInvoice.updateOne({ _id: a2._id }, { $set: { paid: 40, payments: [{ amount: 40, paidAt: new Date('2026-09-06'), paymentId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }] } })
    );

    await api('patch', '/supplier-invoices/payments/aaaaaaaaaaaaaaaaaaaaaaaa', { amount: 25 });
    let invoices = await byNo();
    expect([invoices['A-1'].paid, invoices['A-2'].paid]).toEqual([0, 25]);

    // Growing past its own invoice, it spills onto the oldest other one.
    await api('patch', '/supplier-invoices/payments/aaaaaaaaaaaaaaaaaaaaaaaa', { amount: 130 });
    invoices = await byNo();
    expect([invoices['A-1'].paid, invoices['A-2'].paid]).toEqual([30, 100]);
  });

  it('spreads in memory without touching unrelated invoices', () => {
    const plans = respreadPayment(
      [
        { id: 'a', amount: 100, paid: 100, payments: [{ amount: 100, paidAt: new Date('2026-09-01'), paymentId: 'other' }] },
        { id: 'b', amount: 100, paid: 30, payments: [{ amount: 30, paidAt: new Date('2026-09-02'), paymentId: 'p' }] },
      ],
      'p',
      60
    );
    expect(plans).toEqual([{ id: 'b', paid: 60, payments: [expect.objectContaining({ amount: 60, paymentId: 'p' })] }]);
  });
});

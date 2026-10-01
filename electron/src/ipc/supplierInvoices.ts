import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbRun, dbTransaction, generateLocalId, now, softDelete, v } from '../db/database';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

/** SQLite keeps the payment history as JSON text; hand the UI a real list. */
function toInvoice(row: any) {
  if (!row) return null;
  return { ...row, payments: JSON.parse(row.payments || '[]') };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** How a supplier was paid; matches the server's SUPPLIER_PAYMENT_METHODS. */
export const SUPPLIER_PAYMENT_METHODS = ['cash', 'card', 'bank', 'cheque'];

const getInvoice = (_id: string) =>
  toInvoice(dbGet('SELECT * FROM supplier_invoices WHERE _id = $id', { $id: _id }));

export function registerSupplierInvoiceHandlers(): void {

  handleLicensed('supplierInvoices:getAll', () => {
    return dbAll('SELECT * FROM supplier_invoices WHERE deletedAt IS NULL ORDER BY date DESC').map(toInvoice);
  });

  handleLicensed('supplierInvoices:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    // An invoice number is recorded once, so a bill cannot be entered twice.
    const duplicate = dbGet(
      `SELECT invoiceNo, supplierName FROM supplier_invoices
       WHERE lower(trim(invoiceNo)) = lower(trim($no)) AND deletedAt IS NULL`,
      { $no: String(data.invoiceNo ?? '') }
    ) as { invoiceNo: string; supplierName: string } | undefined;
    if (duplicate) {
      throw new Error(`Invoice ${duplicate.invoiceNo} is already recorded (supplier: ${duplicate.supplierName})`);
    }

    // Ledgers are kept per supplier name, so a saved supplier's exact spelling is used.
    const supplier = dbGet(
      `SELECT _id, name FROM suppliers WHERE lower(trim(name)) = lower(trim($name)) AND deletedAt IS NULL`,
      { $name: String(data.supplierName ?? '') }
    ) as { _id: string; name: string } | undefined;
    if (supplier) data = { ...data, supplierName: supplier.name, supplierId: supplier._id };
    // Money paid when the invoice is entered is the first line of its payment history.
    const paid = Number(data.paid) || 0;
    const payments =
      paid > 0 ? [{ amount: paid, remarks: 'Paid when the invoice was recorded', paidAt: ts, paymentId: generateLocalId(), method: 'cash' }] : [];
    dbRun(
      `INSERT INTO supplier_invoices
         (_id, supplierId, supplierName, invoiceNo, amount, paid, date, remarks, payments, lastPaymentAt, createdAt, updatedAt, isSync)
       VALUES
         ($id, $supplierId, $supplierName, $invoiceNo, $amount, $paid, $date, $remarks, $payments, $lastPaymentAt, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $supplierId: v(data.supplierId, ''),
        $supplierName: v(data.supplierName),
        $invoiceNo: v(data.invoiceNo),
        $amount: v(data.amount, 0),
        $paid: v(data.paid, 0),
        $date: v(data.date, ts),
        $remarks: v(data.remarks, ''),
        $payments: JSON.stringify(payments),
        $lastPaymentAt: paid > 0 ? ts : null,
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return getInvoice(_id);
  });

  handleLicensed('supplierInvoices:pay', (_e, _id: string, data: Record<string, unknown>) => {
    const invoice = getInvoice(_id);
    if (!invoice) throw new Error('Supplier invoice not found');

    const amount = Number(data.amount);
    if (!(amount > 0)) throw new Error('Amount must be more than zero');

    const balance = Math.max(0, Number(invoice.amount) - Number(invoice.paid));
    if (amount > balance + ROUNDING_TOLERANCE) {
      throw new Error(`The balance on this invoice is ${balance.toFixed(2)}; a payment cannot be more than that`);
    }

    const ts = now();
    const payments = [
      ...invoice.payments,
      { amount, remarks: String(data.remarks ?? '').trim(), paidAt: ts, paymentId: generateLocalId(), method: 'cash' },
    ];
    dbRun(
      `UPDATE supplier_invoices
       SET paid=$paid, payments=$payments, lastPaymentAt=$ts, updatedAt=$ts, isSync=0
       WHERE _id=$id`,
      { $paid: Number(invoice.paid) + amount, $payments: JSON.stringify(payments), $ts: ts, $id: _id }
    );
    return getInvoice(_id);
  });

  handleLicensed('supplierInvoices:update', (_e, _id: string, data: Record<string, unknown>) => {
    const ts = now();
    dbRun(
      `UPDATE supplier_invoices
       SET paid=$paid, lastPaymentAt=$lastPaymentAt, updatedAt=$updatedAt, isSync=0
       WHERE _id=$id`,
      {
        $paid: v(data.paid),
        $lastPaymentAt: v(data.lastPaymentAt, null),
        $updatedAt: ts,
        $id: _id
      }
    );
    return getInvoice(_id);
  });

  // Pays the supplier rather than one invoice: their oldest unpaid invoices are cleared first,
  // each recording its share under one payment id so the ledger shows a single payment.
  handleLicensed('supplierInvoices:paySupplier', (_e, data: Record<string, unknown>) => {
    const supplierName = String(data.supplierName ?? '').trim();
    const amount = round2(Number(data.amount));
    if (!supplierName) throw new Error('Choose a supplier');
    if (!(amount > 0)) throw new Error('Amount must be more than zero');

    const open = dbAll(
      `SELECT * FROM supplier_invoices
       WHERE lower(trim(supplierName)) = lower(trim($name)) AND deletedAt IS NULL AND amount > paid + $tolerance
       ORDER BY date ASC, createdAt ASC`,
      { $name: supplierName, $tolerance: ROUNDING_TOLERANCE }
    ).map(toInvoice);

    const owed = round2(open.reduce((sum, invoice) => sum + Number(invoice.amount) - Number(invoice.paid), 0));
    if (open.length === 0) throw new Error(`Nothing is owed to ${supplierName}`);
    if (amount > owed + ROUNDING_TOLERANCE) {
      throw new Error(`${supplierName} is owed ${owed.toFixed(2)}; a payment cannot be more than that`);
    }

    const paymentId = generateLocalId();
    const ts = now();
    const remarks = String(data.remarks ?? '').trim();
    const method = SUPPLIER_PAYMENT_METHODS.includes(data.method as any) ? String(data.method) : 'cash';
    const applied: { invoiceId: string; invoiceNo: string; amount: number }[] = [];

    dbTransaction((d) => {
      let remaining = amount;
      for (const invoice of open) {
        if (remaining <= ROUNDING_TOLERANCE) break;
        const share = round2(Math.min(remaining, Number(invoice.amount) - Number(invoice.paid)));
        const payments = [...invoice.payments, { amount: share, remarks, paidAt: ts, paymentId, method }];
        d.run(
          `UPDATE supplier_invoices
           SET paid=$paid, payments=$payments, lastPaymentAt=$ts, updatedAt=$ts, isSync=0
           WHERE _id=$id`,
          { $paid: round2(Number(invoice.paid) + share), $payments: JSON.stringify(payments), $ts: ts, $id: invoice._id }
        );
        applied.push({ invoiceId: invoice._id, invoiceNo: invoice.invoiceNo, amount: share });
        remaining = round2(remaining - share);
      }
    });

    return { paymentId, amount, applied };
  });

  handleLicensed('supplierInvoices:delete', (_e, _id: string) => {
    softDelete('supplier_invoices', _id);
    return { success: true };
  });
}

import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbRun, generateLocalId, now, softDelete, v } from '../db/database';

export function registerSupplierInvoiceHandlers(): void {

  handleLicensed('supplierInvoices:getAll', () => {
    return dbAll('SELECT * FROM supplier_invoices WHERE deletedAt IS NULL ORDER BY date DESC');
  });

  handleLicensed('supplierInvoices:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO supplier_invoices
         (_id, supplierId, supplierName, invoiceNo, amount, paid, date, lastPaymentAt, createdAt, updatedAt, isSync)
       VALUES
         ($id, $supplierId, $supplierName, $invoiceNo, $amount, $paid, $date, $lastPaymentAt, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $supplierId: v(data.supplierId, ''),
        $supplierName: v(data.supplierName),
        $invoiceNo: v(data.invoiceNo),
        $amount: v(data.amount, 0),
        $paid: v(data.paid, 0),
        $date: v(data.date, ts),
        $lastPaymentAt: v(data.lastPaymentAt, null),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM supplier_invoices WHERE _id = $id', { $id: _id });
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
    return dbGet('SELECT * FROM supplier_invoices WHERE _id = $id', { $id: _id });
  });

  handleLicensed('supplierInvoices:delete', (_e, _id: string) => {
    softDelete('supplier_invoices', _id);
    return { success: true };
  });
}

import { handleLicensed } from '../license/licenseGuard';
import { assertNameFree, dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';
import { setOpeningBalance } from './customerLedger';

export function registerCustomerHandlers(): void {

  handleLicensed('customers:getAll', () => {
    return dbAll('SELECT * FROM customers WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  handleLicensed('customers:create', (_e, data: Record<string, unknown>) => {
    assertNameFree('customers', 'customer', data.name);
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO customers
         (_id, name, contactNum1, contactNum2, email, address, eircode,
          qrCode, barcode, birthday, anniversary, timesVisited, totalAmount,
          outstandingBalance, openingBalance, creditLimit,
          lastVisit, loyaltyPoints, createdAt, updatedAt, isSync)
       VALUES
         ($id, $name, $c1, $c2, $email, $address, $eircode,
          $qrCode, $barcode, $birthday, $anniversary, $timesVisited, $totalAmount,
          $outstandingBalance, $openingBalance, $creditLimit,
          $lastVisit, $loyaltyPoints, $createdAt, $updatedAt, 0)`,
      {
        $id: _id, $name: v(data.name), $c1: v(data.contactNum1),
        $c2: v(data.contactNum2, ''), $email: v(data.email, ''),
        $address: v(data.address, ''), $eircode: v(data.eircode, ''),
        $qrCode: v(data.qrCode, ''), $barcode: v(data.barcode, ''),
        $birthday: v(data.birthday), $anniversary: v(data.anniversary),
        $timesVisited: v(data.timesVisited, 0), $totalAmount: v(data.totalAmount, 0),
        $outstandingBalance: v(data.openingBalance, 0), // Init outstanding with opening
        $openingBalance: v(data.openingBalance, 0),
        $creditLimit: v(data.creditLimit, 0),
        $lastVisit: v(data.lastVisit, ''), $loyaltyPoints: v(data.loyaltyPoints, 0),
        $createdAt: ts, $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  handleLicensed('customers:update', (_e, _id: string, data: Record<string, unknown>) => {
    assertNameFree('customers', 'customer', data.name, _id);
    // A new opening balance moves what the customer owes by the same amount.
    if (data.openingBalance !== undefined && data.openingBalance !== null) setOpeningBalance(_id, data.openingBalance);
    dbRun(
      `UPDATE customers SET
         name=$name, contactNum1=$c1, contactNum2=$c2, email=$email,
         address=$address, eircode=$eircode, qrCode=$qrCode, barcode=$barcode,
         birthday=$birthday, anniversary=$anniversary, timesVisited=$timesVisited,
         totalAmount=$totalAmount, creditLimit=$creditLimit,
         lastVisit=$lastVisit, loyaltyPoints=$loyaltyPoints,
         updatedAt=$ts, isSync=0
       WHERE _id=$id AND deletedAt IS NULL`,
      {
        $id: _id, $name: v(data.name), $c1: v(data.contactNum1),
        $c2: v(data.contactNum2, ''), $email: v(data.email, ''),
        $address: v(data.address, ''), $eircode: v(data.eircode, ''),
        $qrCode: v(data.qrCode, ''), $barcode: v(data.barcode, ''),
        $birthday: v(data.birthday), $anniversary: v(data.anniversary),
        $timesVisited: v(data.timesVisited, 0), $totalAmount: v(data.totalAmount, 0),
        $creditLimit: v(data.creditLimit, 0),
        $lastVisit: v(data.lastVisit, ''), $loyaltyPoints: v(data.loyaltyPoints, 0),
        $ts: now(),
      }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  handleLicensed('customers:delete', (_e, _id: string) => {
    softDelete('customers', _id);
    return { success: true };
  });

  handleLicensed('customers:updateStats', (_e, _id: string, amount: number) => {
    const ts = now();
    dbRun(
      `UPDATE customers SET timesVisited = timesVisited + 1, totalAmount = totalAmount + $amount,
         lastVisit=$ts, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`,
      { $id: _id, $amount: amount, $ts: ts }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  handleLicensed('customers:resetPoints', (_e, _id: string) => {
    dbRun(
      `UPDATE customers SET loyaltyPoints=0, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`,
      { $id: _id, $ts: now() }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  handleLicensed('customers:getLedger', (_e, _id: string) => {
    // Same as the server: voided sales and deleted payments are not part of the account.
    const orders = dbAll(
      `SELECT * FROM orders WHERE customerId = $id AND status != 'voided' ORDER BY createdAt DESC`,
      { $id: _id }
    );
    const payments = dbAll(
      `SELECT * FROM customer_payments WHERE customerId = $id AND (deletedAt IS NULL OR deletedAt = '') ORDER BY createdAt DESC`,
      { $id: _id }
    );
    const returns = dbAll(
      `SELECT * FROM product_returns WHERE customerId = $id AND (deletedAt IS NULL OR deletedAt = '') ORDER BY createdAt DESC`,
      { $id: _id }
    );
    const customer = dbGet(`SELECT * FROM customers WHERE _id = $id`, { $id: _id });
    return {
      orders: orders.map((r: any) => ({ ...r, items: JSON.parse((r.items as string) || '[]') })),
      payments,
      returns: returns.map((r: any) => ({ ...r, items: JSON.parse((r.items as string) || '[]') })),
      customer
    };
  });

  handleLicensed('customers:addPayment', (_e, data: Record<string, unknown>) => {
    const amount = Number(data.amountPaid ?? 0);
    if (!(amount > 0)) throw new Error('Amount must be more than zero');

    const owing = dbGet('SELECT name, outstandingBalance FROM customers WHERE _id = $id', { $id: v(data.customerId) }) as any;
    if (!owing) throw new Error('Customer not found');
    const owed = Number(owing.outstandingBalance) || 0;
    if (amount > owed + 0.005) {
      throw new Error(`${owing.name} owes ${owed.toFixed(2)}; a payment cannot be more than that`);
    }

    const _id = generateLocalId();
    const ts = now();
    
    // Add payment
    dbRun(
      `INSERT INTO customer_payments (_id, customerId, customerName, amountPaid, paymentMethod, date, notes, createdAt, updatedAt, isSync)
       VALUES ($id, $cid, $cname, $amount, $method, $date, $notes, $ts, $ts, 0)`,
      {
        $id: _id,
        $cid: v(data.customerId),
        $cname: v(data.customerName),
        $amount: Number(data.amountPaid ?? 0),
        $method: v(data.paymentMethod),
        $date: v(data.date, new Date().toISOString().split('T')[0]),
        $notes: v(data.notes, ''),
        $ts: ts
      }
    );

    // Deduct from outstanding balance
    dbRun(
      `UPDATE customers SET outstandingBalance = outstandingBalance - $amount, updatedAt=$ts, isSync=0 WHERE _id=$cid`,
      { $amount: Number(data.amountPaid ?? 0), $ts: ts, $cid: v(data.customerId) }
    );

    const payment = dbGet('SELECT * FROM customer_payments WHERE _id = $id', { $id: _id });
    const customer = dbGet('SELECT * FROM customers WHERE _id = $id', { $id: v(data.customerId) });

    return { payment, customer };
  });
}

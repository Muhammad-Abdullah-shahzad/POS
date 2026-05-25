import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

export function registerCustomerHandlers(): void {

  ipcMain.handle('customers:getAll', () => {
    return dbAll('SELECT * FROM customers WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  ipcMain.handle('customers:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO customers
         (_id, name, contactNum1, contactNum2, email, address, eircode,
          qrCode, barcode, birthday, anniversary, timesVisited, totalAmount,
          lastVisit, loyaltyPoints, createdAt, updatedAt, isSync)
       VALUES
         ($id, $name, $c1, $c2, $email, $address, $eircode,
          $qrCode, $barcode, $birthday, $anniversary, $timesVisited, $totalAmount,
          $lastVisit, $loyaltyPoints, $createdAt, $updatedAt, 0)`,
      {
        $id: _id, $name: v(data.name), $c1: v(data.contactNum1),
        $c2: v(data.contactNum2, ''), $email: v(data.email, ''),
        $address: v(data.address, ''), $eircode: v(data.eircode, ''),
        $qrCode: v(data.qrCode, ''), $barcode: v(data.barcode, ''),
        $birthday: v(data.birthday), $anniversary: v(data.anniversary),
        $timesVisited: v(data.timesVisited, 0), $totalAmount: v(data.totalAmount, 0),
        $lastVisit: v(data.lastVisit, ''), $loyaltyPoints: v(data.loyaltyPoints, 0),
        $createdAt: ts, $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('customers:update', (_e, _id: string, data: Record<string, unknown>) => {
    dbRun(
      `UPDATE customers SET
         name=$name, contactNum1=$c1, contactNum2=$c2, email=$email,
         address=$address, eircode=$eircode, qrCode=$qrCode, barcode=$barcode,
         birthday=$birthday, anniversary=$anniversary, timesVisited=$timesVisited,
         totalAmount=$totalAmount, lastVisit=$lastVisit, loyaltyPoints=$loyaltyPoints,
         updatedAt=$ts, isSync=0
       WHERE _id=$id AND deletedAt IS NULL`,
      {
        $id: _id, $name: v(data.name), $c1: v(data.contactNum1),
        $c2: v(data.contactNum2, ''), $email: v(data.email, ''),
        $address: v(data.address, ''), $eircode: v(data.eircode, ''),
        $qrCode: v(data.qrCode, ''), $barcode: v(data.barcode, ''),
        $birthday: v(data.birthday), $anniversary: v(data.anniversary),
        $timesVisited: v(data.timesVisited, 0), $totalAmount: v(data.totalAmount, 0),
        $lastVisit: v(data.lastVisit, ''), $loyaltyPoints: v(data.loyaltyPoints, 0),
        $ts: now(),
      }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('customers:delete', (_e, _id: string) => {
    softDelete('customers', _id);
    return { success: true };
  });

  ipcMain.handle('customers:updateStats', (_e, _id: string, amount: number) => {
    const ts = now();
    dbRun(
      `UPDATE customers SET timesVisited = timesVisited + 1, totalAmount = totalAmount + $amount,
         lastVisit=$ts, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`,
      { $id: _id, $amount: amount, $ts: ts }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('customers:resetPoints', (_e, _id: string) => {
    dbRun(
      `UPDATE customers SET loyaltyPoints=0, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`,
      { $id: _id, $ts: now() }
    );
    return dbGet('SELECT * FROM customers WHERE _id = $id', { $id: _id });
  });
}

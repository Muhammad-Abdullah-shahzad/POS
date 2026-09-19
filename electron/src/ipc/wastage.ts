import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbRun, generateLocalId, now, softDelete, v } from '../db/database';

export function registerWastageHandlers(): void {

  handleLicensed('wastage:getAll', () => {
    return dbAll('SELECT * FROM wastage WHERE deletedAt IS NULL ORDER BY date DESC');
  });

  handleLicensed('wastage:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    
    // Decrement stock in SQLite first (matching server behavior)
    const qty = v(data.quantity, 0) as number;
    if (qty > 0) {
      dbRun(
        `UPDATE products SET stock = stock - $qty, updatedAt = $ts, isSync = 0 WHERE _id = $id`,
        { $qty: qty, $ts: ts, $id: v(data.productId) }
      );
    }

    dbRun(
      `INSERT INTO wastage
         (_id, productId, productName, sku, quantity, unitCost, reason, date, recordedBy, createdAt, updatedAt, isSync)
       VALUES
         ($id, $productId, $productName, $sku, $quantity, $unitCost, $reason, $date, $recordedBy, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $productId: v(data.productId),
        $productName: v(data.productName),
        $sku: v(data.sku, ''),
        $quantity: qty,
        $unitCost: v(data.unitCost, 0),
        $reason: v(data.reason),
        $date: v(data.date, ts),
        $recordedBy: v(data.recordedBy, ''),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM wastage WHERE _id = $id', { $id: _id });
  });

  handleLicensed('wastage:update', (_e, _id: string, data: Record<string, unknown>) => {
    const ts = now();
    dbRun(
      `UPDATE wastage
       SET reason=$reason, updatedAt=$updatedAt, isSync=0
       WHERE _id=$id`,
      { $reason: v(data.reason), $updatedAt: ts, $id: _id }
    );
    return dbGet('SELECT * FROM wastage WHERE _id = $id', { $id: _id });
  });

  handleLicensed('wastage:delete', (_e, _id: string) => {
    softDelete('wastage', _id);
    return { success: true };
  });
}

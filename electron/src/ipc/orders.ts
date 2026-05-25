import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { dbAll, dbGet, dbRun, dbTransaction, generateLocalId, now, v, BindMap } from '../db/database';

export function registerOrderHandlers(): void {

  ipcMain.handle('orders:getAll', (_e: IpcMainInvokeEvent, month?: number, year?: number) => {
    let rows: Record<string, unknown>[];
    if (month && year) {
      const start = new Date(year, month - 1, 1).toISOString();
      const end   = new Date(year, month, 1).toISOString();
      rows = dbAll(
        `SELECT * FROM orders WHERE status != 'voided'
         AND createdAt >= $start AND createdAt < $end
         ORDER BY createdAt DESC LIMIT 100`,
        { $start: start, $end: end }
      );
    } else {
      rows = dbAll(`SELECT * FROM orders WHERE status != 'voided' ORDER BY createdAt DESC LIMIT 100`);
    }
    return rows.map((r) => ({ ...r, items: JSON.parse((r.items as string) || '[]') }));
  });

  ipcMain.handle('orders:getVoided', (_e: IpcMainInvokeEvent) => {
    const rows = dbAll(`SELECT * FROM orders WHERE status = 'voided' ORDER BY voidedAt DESC LIMIT 500`);
    return rows.map((r) => ({ ...r, items: JSON.parse((r.items as string) || '[]') }));
  });

  ipcMain.handle('orders:create', (_e: IpcMainInvokeEvent, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    const invoiceId = `REC-${Date.now()}`;
    const itemsArr = (data.items as any[]) ?? [];
    const itemsJson = JSON.stringify(itemsArr);

    dbTransaction((d) => {
      // Deduct stock for each item that has a product reference
      for (const item of itemsArr) {
        const productId = item.product || item.productId;
        if (productId) {
          const stmt = d.prepare(`SELECT stock FROM products WHERE _id = $pid`);
          stmt.bind({ $pid: productId } as BindMap);
          let currentStock = 0;
          if (stmt.step()) {
            const row = stmt.getAsObject() as any;
            currentStock = Number(row.stock ?? 0);
          }
          stmt.free();

          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}`);
          }

          d.run(
            `UPDATE products SET stock = stock - $qty, updatedAt=$ts, isSync=0 WHERE _id=$pid`,
            { $qty: Number(item.quantity), $ts: ts, $pid: String(productId) } as BindMap
          );
        }
      }

      d.run(
        `INSERT INTO orders
           (_id, invoiceId, items, subtotal, totalVAT, discount, totalDRS, total,
            paymentMethod, splitCash, splitCard, status, createdAt, updatedAt, isSync)
         VALUES
           ($id, $invoiceId, $items, $subtotal, $totalVAT, $discount, $totalDRS, $total,
            $paymentMethod, $splitCash, $splitCard, 'completed', $createdAt, $updatedAt, 0)`,
        {
          $id: _id,
          $invoiceId: invoiceId,
          $items: itemsJson,
          $subtotal: Number(data.subtotal ?? 0),
          $totalVAT: Number(data.totalVAT ?? 0),
          $discount: Number(data.discount ?? 0),
          $totalDRS: Number(data.totalDRS ?? 0),
          $total: Number(data.total ?? 0),
          $paymentMethod: String(data.paymentMethod ?? ''),
          $splitCash: data.splitCash != null ? Number(data.splitCash) : null,
          $splitCard: data.splitCard != null ? Number(data.splitCard) : null,
          $createdAt: ts,
          $updatedAt: ts,
        } as BindMap
      );
    });

    const row = dbGet('SELECT * FROM orders WHERE _id = $id', { $id: _id }) as any;
    return { ...row, items: JSON.parse(row?.items || '[]') };
  });

  ipcMain.handle('orders:void', (_e: IpcMainInvokeEvent, _id: string, reason: string, employeeId?: string, employeeName?: string) => {
    const ts = now();

    const order = dbGet('SELECT * FROM orders WHERE _id = $id', { $id: _id }) as any;
    if (!order) return null;

    dbTransaction((d) => {
      d.run(
        `UPDATE orders SET
           status='voided', voidReason=$reason, voidedAt=$ts,
           voidedByEmployee=$empId, voidedByEmployeeName=$empName,
           updatedAt=$ts, isSync=0
         WHERE _id=$id AND status != 'voided'`,
        {
          $id: _id,
          $reason: reason,
          $ts: ts,
          $empId: employeeId ?? null,
          $empName: employeeName ?? null,
        } as BindMap
      );

      // Restore stock
      const items = JSON.parse(order.items || '[]');
      for (const item of items) {
        const productId = item.product || item.productId;
        if (productId) {
          d.run(
            `UPDATE products SET stock = stock + $qty, updatedAt=$ts, isSync=0 WHERE _id=$pid`,
            { $qty: Number(item.quantity), $ts: ts, $pid: String(productId) } as BindMap
          );
        }
      }
    });

    const row = dbGet('SELECT * FROM orders WHERE _id = $id', { $id: _id }) as any;
    return { ...row, items: JSON.parse(row?.items || '[]') };
  });
}

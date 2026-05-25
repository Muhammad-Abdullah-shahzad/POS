import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

export function registerSupplierHandlers(): void {

  ipcMain.handle('suppliers:getAll', () => {
    return dbAll('SELECT * FROM suppliers WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  ipcMain.handle('suppliers:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO suppliers (_id, name, contact, emailId, address, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $contact, $emailId, $address, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $name: v(data.name),
        $contact: v(data.contact),
        $emailId: v(data.emailId),
        $address: v(data.address),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM suppliers WHERE _id = $id', { $id: _id });
  });
}

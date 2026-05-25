import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

export function registerCategoryHandlers(): void {

  ipcMain.handle('categories:getAll', () => {
    const rows = dbAll('SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY name ASC');
    return rows.map((r) => ({ ...r, items: JSON.parse((r.items as string) || '[]') }));
  });

  ipcMain.handle('categories:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO categories (_id, name, items, vatRate, vatType, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $items, $vatRate, $vatType, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $name: v(data.name),
        $items: JSON.stringify(data.items ?? []),
        $vatRate: v(data.vatRate, 0),
        $vatType: v(data.vatType, 'exclusive'),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    const row = dbGet('SELECT * FROM categories WHERE _id = $id', { $id: _id }) as any;
    return { ...row, items: JSON.parse(row?.items || '[]') };
  });

  ipcMain.handle('categories:update', (_e, _id: string, data: Record<string, unknown>) => {
    dbRun(
      `UPDATE categories SET name=$name, items=$items, vatRate=$vatRate, vatType=$vatType,
       updatedAt=$ts, isSync=0 WHERE _id=$id`,
      {
        $id: _id,
        $name: v(data.name),
        $items: JSON.stringify(data.items ?? []),
        $vatRate: v(data.vatRate, 0),
        $vatType: v(data.vatType, 'exclusive'),
        $ts: now(),
      }
    );
    const row = dbGet('SELECT * FROM categories WHERE _id = $id', { $id: _id }) as any;
    return { ...row, items: JSON.parse(row?.items || '[]') };
  });

  ipcMain.handle('categories:delete', (_e, _id: string) => {
    softDelete('categories', _id);
    return { success: true };
  });
}

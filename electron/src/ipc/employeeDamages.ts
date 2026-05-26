import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, softDelete, v } from '../db/database';

export function registerEmployeeDamageHandlers(): void {

  ipcMain.handle('employeeDamages:getAll', () => {
    return dbAll('SELECT * FROM employee_damages WHERE deletedAt IS NULL ORDER BY date DESC');
  });

  ipcMain.handle('employeeDamages:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO employee_damages
         (_id, employeeId, employeeName, item, value, deduction, status, date, createdAt, updatedAt, isSync)
       VALUES
         ($id, $employeeId, $employeeName, $item, $value, $deduction, $status, $date, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $employeeId: v(data.employeeId),
        $employeeName: v(data.employeeName),
        $item: v(data.item),
        $value: v(data.value, 0),
        $deduction: v(data.deduction, 0),
        $status: v(data.status, 'Pending Approval'),
        $date: v(data.date, ts),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM employee_damages WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('employeeDamages:update', (_e, _id: string, data: Record<string, unknown>) => {
    const ts = now();
    dbRun(
      `UPDATE employee_damages
       SET status=$status, updatedAt=$updatedAt, isSync=0
       WHERE _id=$id`,
      { $status: v(data.status), $updatedAt: ts, $id: _id }
    );
    return dbGet('SELECT * FROM employee_damages WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('employeeDamages:delete', (_e, _id: string) => {
    softDelete('employee_damages', _id);
    return { success: true };
  });
}

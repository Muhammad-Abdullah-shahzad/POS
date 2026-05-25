import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

export function registerEmployeeHandlers(): void {

  ipcMain.handle('employees:getAll', () => {
    return dbAll('SELECT * FROM employees WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  ipcMain.handle('employees:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO employees (_id, name, contactNo, emailId, address, role, gender, dob, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $contactNo, $emailId, $address, $role, $gender, $dob, $createdAt, $updatedAt, 0)`,
      {
        $id: _id, $name: v(data.name), $contactNo: v(data.contactNo),
        $emailId: v(data.emailId), $address: v(data.address),
        $role: v(data.role), $gender: v(data.gender), $dob: v(data.dob),
        $createdAt: ts, $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM employees WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('employees:update', (_e, _id: string, data: Record<string, unknown>) => {
    dbRun(
      `UPDATE employees SET name=$name, contactNo=$contactNo, emailId=$emailId,
       address=$address, role=$role, gender=$gender, dob=$dob,
       updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`,
      {
        $id: _id, $name: v(data.name), $contactNo: v(data.contactNo),
        $emailId: v(data.emailId), $address: v(data.address),
        $role: v(data.role), $gender: v(data.gender), $dob: v(data.dob),
        $ts: now(),
      }
    );
    return dbGet('SELECT * FROM employees WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('employees:delete', (_e, _id: string) => {
    softDelete('employees', _id);
    return { success: true };
  });
}

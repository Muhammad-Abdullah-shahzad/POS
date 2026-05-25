import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

export function registerBankHandlers(): void {

  // ── BANK NAMES ────────────────────────────────────────────────────────────
  ipcMain.handle('banks:getNames', () => {
    return dbAll('SELECT * FROM bank_names WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  ipcMain.handle('banks:addName', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO bank_names (_id, name, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $createdAt, $updatedAt, 0)`,
      { $id: _id, $name: v(data.name), $createdAt: ts, $updatedAt: ts }
    );
    return dbGet('SELECT * FROM bank_names WHERE _id = $id', { $id: _id });
  });

  // ── BANK ACCOUNTS ─────────────────────────────────────────────────────────
  ipcMain.handle('banks:getAccounts', () => {
    return dbAll('SELECT * FROM bank_accounts WHERE deletedAt IS NULL ORDER BY accountName ASC');
  });

  ipcMain.handle('banks:addAccount', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO bank_accounts (_id, bankName, type, accountName, iban, bic, createdAt, updatedAt, isSync)
       VALUES ($id, $bankName, $type, $accountName, $iban, $bic, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $bankName: v(data.bankName),
        $type: v(data.type),
        $accountName: v(data.accountName),
        $iban: v(data.iban),
        $bic: v(data.bic),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM bank_accounts WHERE _id = $id', { $id: _id });
  });

  // ── BANK CARDS ────────────────────────────────────────────────────────────
  ipcMain.handle('banks:getCards', () => {
    return dbAll('SELECT * FROM bank_cards WHERE deletedAt IS NULL ORDER BY cardName ASC');
  });

  ipcMain.handle('banks:addCard', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO bank_cards (_id, bankName, accountName, type, cardNumber, cardName, expiryDate, createdAt, updatedAt, isSync)
       VALUES ($id, $bankName, $accountName, $type, $cardNumber, $cardName, $expiryDate, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $bankName: v(data.bankName),
        $accountName: v(data.accountName),
        $type: v(data.type),
        $cardNumber: v(data.cardNumber),
        $cardName: v(data.cardName),
        $expiryDate: v(data.expiryDate),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM bank_cards WHERE _id = $id', { $id: _id });
  });
}

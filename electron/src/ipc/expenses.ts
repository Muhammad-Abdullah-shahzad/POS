import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbRun, generateLocalId, now, v } from '../db/database';

export function registerExpenseHandlers(): void {

  handleLicensed('expenses:getAll', () => {
    return dbAll('SELECT * FROM expenses ORDER BY date DESC');
  });

  handleLicensed('expenses:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO expenses (_id, title, amount, category, date, paymentMethod, notes, attachmentUrl, createdAt, updatedAt, isSync)
       VALUES ($id, $title, $amount, $category, $date, $paymentMethod, $notes, $attachmentUrl, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $title: v(data.title),
        $amount: v(data.amount, 0),
        $category: v(data.category),
        $date: v(data.date, ts),
        $paymentMethod: v(data.paymentMethod),
        $notes: v(data.notes),
        $attachmentUrl: v(data.attachmentUrl),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM expenses WHERE _id = $id', { $id: _id });
  });

  // ── Expense Categories ────────────────────────────────────────────────────

  handleLicensed('expenseCategories:getAll', () => {
    return dbAll('SELECT * FROM expense_categories ORDER BY name ASC');
  });

  handleLicensed('expenseCategories:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT OR IGNORE INTO expense_categories (_id, name, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $createdAt, $updatedAt, 0)`,
      { $id: _id, $name: v(data.name), $createdAt: ts, $updatedAt: ts }
    );
    return dbGet('SELECT * FROM expense_categories WHERE name = $name', { $name: v(data.name) });
  });

  handleLicensed('expenseCategories:delete', (_e, _id: string) => {
    dbRun('DELETE FROM expense_categories WHERE _id = $id', { $id: _id });
    return { success: true };
  });
}

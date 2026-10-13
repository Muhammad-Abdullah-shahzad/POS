import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbRun, generateLocalId, now, v } from '../db/database';

/** SQLite keeps JSON as text and booleans as 0/1; hand the UI real values. */
function toSettings(row: any) {
  if (!row) return null;
  return {
    ...row,
    showRemarksPrompt: row.showRemarksPrompt !== 0,
    quickProducts: JSON.parse(row.quickProducts || '[]'),
  };
}

/**
 * The till's one settings record: the one with unsent edits if any, else the
 * newest. (A pull leaves exactly one; this also copes with older tills that
 * ended up with two.)
 */
const CURRENT_SETTINGS = `SELECT * FROM settings ORDER BY isSync ASC, updatedAt DESC LIMIT 1`;

/** The current record's id, creating a placeholder on first use. */
function ensureSettings(): string {
  const existing = dbGet(CURRENT_SETTINGS) as { _id: string } | undefined;
  if (existing) return existing._id;

  // A placeholder with defaults until the first pull brings the company's
  // record. It has nothing to send, so it is marked synced and a pull simply
  // replaces it.
  const _id = generateLocalId();
  const ts = now();
  dbRun(`INSERT INTO settings (_id, createdAt, updatedAt, isSync) VALUES ($id, $ts, $ts, 1)`, { $id: _id, $ts: ts });
  return _id;
}

export function registerSettingsHandlers(): void {

  handleLicensed('settings:get', () => {
    ensureSettings();
    return toSettings(dbGet(CURRENT_SETTINGS));
  });

  handleLicensed('settings:update', (_e, data: Record<string, unknown>) => {
    const id = ensureSettings();
    dbRun(
      `UPDATE settings SET
         shopName=$shopName, shopAddress=$shopAddress, shopPhone=$shopPhone,
         shopEmail=$shopEmail, shopWebsite=$shopWebsite, receiptFooter=$receiptFooter,
         receiptSize=$receiptSize, showRemarksPrompt=$showRemarksPrompt,
         loyaltyPointsPerEuro=$loyaltyPPE, loyaltyRewardThreshold=$loyaltyRT,
         loyaltyRewardValue=$loyaltyRV,
         quickProducts=COALESCE($quickProducts, quickProducts),
         updatedAt=$ts, isSync=0
       WHERE _id=$id`,
      {
        $shopName: v(data.shopName),
        $shopAddress: v(data.shopAddress),
        $shopPhone: v(data.shopPhone, ''),
        $shopEmail: v(data.shopEmail, ''),
        $shopWebsite: v(data.shopWebsite, ''),
        $receiptFooter: v(data.receiptFooter, ''),
        $receiptSize: data.receiptSize === 'A4' ? 'A4' : 'Thermal',
        $showRemarksPrompt: data.showRemarksPrompt === false ? 0 : 1,
        $loyaltyPPE: v(data.loyaltyPointsPerEuro, 1),
        $loyaltyRT: v(data.loyaltyRewardThreshold, 100),
        $loyaltyRV: v(data.loyaltyRewardValue, 5),
        // The settings form does not send quick products; keep them unless given.
        $quickProducts: Array.isArray(data.quickProducts) ? JSON.stringify(data.quickProducts) : null,
        $ts: now(),
        $id: id,
      }
    );
    return toSettings(dbGet('SELECT * FROM settings WHERE _id = $id', { $id: id }));
  });

  handleLicensed('settings:getQuickProducts', () => {
    ensureSettings();
    const row = dbGet(CURRENT_SETTINGS) as any;
    return JSON.parse(row?.quickProducts || '[]');
  });

  handleLicensed('settings:updateQuickProducts', (_e, quickProducts: unknown[]) => {
    const id = ensureSettings();
    dbRun(
      `UPDATE settings SET quickProducts=$qp, updatedAt=$ts, isSync=0 WHERE _id=$id`,
      { $qp: JSON.stringify(quickProducts), $ts: now(), $id: id }
    );
    return quickProducts;
  });
}

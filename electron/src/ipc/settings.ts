import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v } from '../db/database';

export function registerSettingsHandlers(): void {

  const ensureSettings = () => {
    const existing = dbGet('SELECT _id FROM settings LIMIT 1');
    if (!existing) {
      const _id = generateLocalId();
      const ts = now();
      dbRun(
        `INSERT INTO settings (_id, createdAt, updatedAt, isSync) VALUES ($id, $ts, $ts, 0)`,
        { $id: _id, $ts: ts }
      );
    }
  };

  ipcMain.handle('settings:get', () => {
    ensureSettings();
    const row = dbGet('SELECT * FROM settings LIMIT 1') as any;
    if (!row) return null;
    return { ...row, quickProducts: JSON.parse(row.quickProducts || '[]') };
  });

  ipcMain.handle('settings:update', (_e, data: Record<string, unknown>) => {
    ensureSettings();
    dbRun(
      `UPDATE settings SET
         shopName=$shopName, shopAddress=$shopAddress, shopPhone=$shopPhone,
         shopEmail=$shopEmail, shopWebsite=$shopWebsite, receiptFooter=$receiptFooter,
         defaultVatRate=$defaultVatRate, isVatInclusiveDefault=$isVatInclusive,
         loyaltyPointsPerEuro=$loyaltyPPE, loyaltyRewardThreshold=$loyaltyRT,
         loyaltyRewardValue=$loyaltyRV, quickProducts=$quickProducts,
         updatedAt=$ts, isSync=0`,
      {
        $shopName: v(data.shopName),
        $shopAddress: v(data.shopAddress),
        $shopPhone: v(data.shopPhone, ''),
        $shopEmail: v(data.shopEmail, ''),
        $shopWebsite: v(data.shopWebsite, ''),
        $receiptFooter: v(data.receiptFooter, ''),
        $defaultVatRate: v(data.defaultVatRate, 20),
        $isVatInclusive: data.isVatInclusiveDefault ? 1 : 0,
        $loyaltyPPE: v(data.loyaltyPointsPerEuro, 1),
        $loyaltyRT: v(data.loyaltyRewardThreshold, 100),
        $loyaltyRV: v(data.loyaltyRewardValue, 5),
        $quickProducts: JSON.stringify(data.quickProducts ?? []),
        $ts: now(),
      }
    );
    const row = dbGet('SELECT * FROM settings LIMIT 1') as any;
    return { ...row, quickProducts: JSON.parse(row?.quickProducts || '[]') };
  });

  ipcMain.handle('settings:getQuickProducts', () => {
    ensureSettings();
    const row = dbGet('SELECT quickProducts FROM settings LIMIT 1') as any;
    return JSON.parse(row?.quickProducts || '[]');
  });

  ipcMain.handle('settings:updateQuickProducts', (_e, quickProducts: unknown[]) => {
    ensureSettings();
    dbRun(
      `UPDATE settings SET quickProducts=$qp, updatedAt=$ts, isSync=0`,
      { $qp: JSON.stringify(quickProducts), $ts: now() }
    );
    return quickProducts;
  });
}

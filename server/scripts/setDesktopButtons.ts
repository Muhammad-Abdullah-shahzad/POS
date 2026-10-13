/**
 * Show or hide the Pull and Sync buttons on a company's desktop tills.
 *
 *   npm run desktop:buttons -- --tenant corner-shop                       show the current setting
 *   npm run desktop:buttons -- --tenant corner-shop --sync hide --pull hide
 *   npm run desktop:buttons -- --tenant corner-shop --sync show --pull show
 *
 * Part of what a company pays for, so it is set here by the operator and
 * never from the company's own settings. Tills pick up a change the next time
 * they open, or when Pull or Sync is pressed.
 */
import { logger } from '../core/logger';
import Tenant, { HIDE_SYNC_BTNS, SHOW_SYNC_BTNS } from '../models/Tenant';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

const CHOICES: Record<string, string> = { show: SHOW_SYNC_BTNS, hide: HIDE_SYNC_BTNS };

/** "show" / "hide" to the stored value; undefined when the flag was not given. */
function choice(args: Record<string, string | boolean>, flag: string): string | undefined {
  const value = args[flag];
  if (value === undefined) return undefined;
  const stored = typeof value === 'string' ? CHOICES[value.toLowerCase()] : undefined;
  if (!stored) throw new Error(`--${flag} must be "show" or "hide"`);
  return stored;
}

runScript('setDesktopButtons', async () => {
  const args = parseArgs();
  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));
  const sync = choice(args, 'sync');
  const pull = choice(args, 'pull');

  const changes: Record<string, string> = {};
  if (sync) changes['desktopBtnSettings.showSyncBtn'] = sync;
  if (pull) changes['desktopBtnSettings.showPullBtn'] = pull;

  const updated = Object.keys(changes).length
    ? await Tenant.findByIdAndUpdate(tenant._id, { $set: changes }, { returnDocument: 'after', runValidators: true })
    : tenant;

  logger.info(
    {
      company: tenant.slug,
      showSyncBtn: updated?.desktopBtnSettings?.showSyncBtn ?? SHOW_SYNC_BTNS,
      showPullBtn: updated?.desktopBtnSettings?.showPullBtn ?? SHOW_SYNC_BTNS,
    },
    Object.keys(changes).length ? 'Desktop buttons updated' : 'Current desktop buttons'
  );
});

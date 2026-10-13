/**
 * Which sync buttons the company's tills show, as the operator set for the
 * company (server: npm run desktop:buttons).
 *
 * Fetched from the server on Pull, Sync and start-up and handed to the screen,
 * which keeps it in localStorage and renders the buttons from there. It is not
 * stored in SQLite: the server owns it, and a till never sends it back.
 */
import type { AxiosInstance } from 'axios';
import { createServerClient } from '../api/serverClient';

export const SHOW_SYNC_BTNS = 'SHOW_SYNC_BTNS';
export const HIDE_SYNC_BTNS = 'HIDE_SYNC_BTNS';
const VISIBILITY = new Set([SHOW_SYNC_BTNS, HIDE_SYNC_BTNS]);

export interface DesktopBtnSettings {
  showSyncBtn: string;
  showPullBtn: string;
}

/** An unknown or missing value means "show", so a till never loses its buttons by mistake. */
const visibility = (value: unknown) => (typeof value === 'string' && VISIBILITY.has(value) ? value : SHOW_SYNC_BTNS);

/**
 * The company's current settings, or null when they cannot be read (offline,
 * signed out, or a server from before this setting existed). Null means "keep
 * what the till already has".
 */
export async function fetchDesktopBtnSettings(client: AxiosInstance | null = createServerClient()): Promise<DesktopBtnSettings | null> {
  if (!client) return null;
  try {
    const response = await client.get('/settings');
    const settings = response.data?.data?.desktopBtnSettings;
    if (!settings || typeof settings !== 'object') return null;
    return { showSyncBtn: visibility(settings.showSyncBtn), showPullBtn: visibility(settings.showPullBtn) };
  } catch {
    return null;
  }
}

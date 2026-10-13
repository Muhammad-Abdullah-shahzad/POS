/**
 * Which sync buttons this desktop till shows, as the operator set for the
 * company (server: npm run desktop:buttons).
 *
 * The desktop app fetches the setting from the server on Pull, Sync and
 * start-up; this module keeps the latest copy in localStorage, and the buttons
 * render from it. Until a copy exists (first launch, or the server has never
 * been reached) every button is shown.
 */
export const SHOW_SYNC_BTNS = 'SHOW_SYNC_BTNS';
export const HIDE_SYNC_BTNS = 'HIDE_SYNC_BTNS';

export interface DesktopBtnSettings {
  showSyncBtn: string;
  showPullBtn: string;
}

const STORAGE_KEY = 'desktopBtnSettings';

/** The saved copy, or null when there is none (or it cannot be read). */
export function readDesktopBtnSettings(): DesktopBtnSettings | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as DesktopBtnSettings) : null;
  } catch {
    return null;
  }
}

export function saveDesktopBtnSettings(settings: DesktopBtnSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: the buttons keep their current state.
  }
}

/**
 * A button shows unless the company explicitly hid it. SHOW_SYNC_BTNS, a
 * missing value and anything unrecognised all show it, so a till cannot lose
 * its buttons through a missing or garbled setting.
 */
export const isButtonShown = (value: string | null | undefined): boolean => value !== HIDE_SYNC_BTNS;

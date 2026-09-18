/**
 * The licence gate inside the desktop app.
 *
 * The renderer's route guard only decides which screen to show, and anything in
 * the renderer can be changed from the developer tools. The check that actually
 * matters therefore runs here, in the main process, before any IPC call reads or
 * writes shop data. It is the offline counterpart of the 402 the server returns.
 *
 * Auth, licence and sync channels keep plain `ipcMain.handle` on purpose:
 * signing in and pasting a key must work while locked, and sync is refused by
 * the server itself.
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getLicenseStatus } from './licenseStore';

/**
 * Prefix of the error a locked call rejects with. Only the message crosses the
 * IPC bridge, so the renderer recognises it by this text
 * (see client/src/services/localApi.ts).
 */
export const LICENSE_REQUIRED_PREFIX = 'LICENSE_REQUIRED';

// `any[]` mirrors Electron's own listener type, which is what lets each module
// keep its precisely typed parameters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;

/** Throw when the till may not touch shop data right now. */
export function assertLicensed(): void {
  const status = getLicenseStatus();
  if (status.state === 'active') return;

  throw new Error(`${LICENSE_REQUIRED_PREFIX}|${status.state}|${status.message}`);
}

/** `ipcMain.handle` for channels that read or write shop data. */
export function handleLicensed(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertLicensed();
    return handler(event, ...args);
  });
}

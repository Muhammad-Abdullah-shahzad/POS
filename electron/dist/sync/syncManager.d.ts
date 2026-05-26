/**
 * syncManager.ts
 *
 * TWO-WAY sync between local SQLite (Electron) and remote MongoDB (web server).
 *
 * PUSH  (local → server): Uploads all rows where isSync = 0.
 * PULL  (server → local): Downloads all rows from the server and upserts them
 *   locally, with the following conflict rule:
 *     - isSync = 0  → local has pending changes; skip (push will send it later)
 *     - isSync = 1  → already clean; overwrite with server version
 *     - missing locally → insert from server
 *     - in SQLite but gone from server → delete locally (web user deleted it)
 */
export interface SyncConfig {
    baseUrl: string;
    token: string;
}
export declare function registerSyncHandlers(): void;

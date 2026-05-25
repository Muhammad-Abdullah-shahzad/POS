/**
 * syncManager.ts
 * Syncs local SQLite → remote MongoDB.
 * Also syncs soft-deletes: sends pending_deletes to /sync/delete on the server.
 */
export interface SyncConfig {
    baseUrl: string;
    token: string;
}
export declare function registerSyncHandlers(): void;

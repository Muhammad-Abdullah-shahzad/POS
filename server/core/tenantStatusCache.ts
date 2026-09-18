/**
 * Per-process cache of the few tenant fields checked on every request.
 *
 * Lives in `core/` rather than inside a service so that both the tenant and
 * the licence services can invalidate it without importing each other.
 */
import { TtlCache } from './ttlCache';
import type { TenantStatus } from '../models/Tenant';

export interface CachedTenant {
  status: TenantStatus;
  name: string;
  /** Null when no licence has been issued. */
  licenseExpiresAt: Date | null;
}

const TENANT_CACHE_TTL_MS = 60_000;

export const tenantStatusCache = new TtlCache<CachedTenant>(TENANT_CACHE_TTL_MS);

export const invalidateTenantCache = (tenantId: string): void => tenantStatusCache.delete(tenantId);

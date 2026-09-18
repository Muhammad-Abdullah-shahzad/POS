/**
 * Per-request tenant context.
 *
 * Every request runs inside an AsyncLocalStorage store that carries the tenant
 * it belongs to. Mongoose models then read that store (see
 * `models/plugins/tenantScope.ts`) and scope every query automatically, so data
 * isolation does not depend on each controller remembering to add a filter.
 *
 * There are exactly three ways to run code:
 *   withTenantScope(tenantId, fn) — normal request handling, scoped to a tenant
 *   withSystemScope(fn)           — migrations, onboarding, cross tenant reads
 *   (no scope)                    — tenant scoped models refuse to run
 *
 * The last case fails closed on purpose: a forgotten scope raises an error
 * rather than silently returning another company's rows.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface RequestContext {
  /** The company whose data this execution may touch. */
  tenantId: string | null;
  /** Set when the caller is an authenticated user. */
  userId?: string;
  role?: UserRole;
  requestId?: string;
  /**
   * True for trusted internal work (onboarding, migrations, CLI scripts) that
   * must reach across tenants. Never set from request input.
   */
  isSystem: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const getContext = (): RequestContext | undefined => storage.getStore();

/** The active tenant, or null when running as the system. */
export const getTenantId = (): string | null => storage.getStore()?.tenantId ?? null;

export const isSystemScope = (): boolean => storage.getStore()?.isSystem === true;

/** True when no scope has been established at all. */
export const hasScope = (): boolean => storage.getStore() !== undefined;

/**
 * Establish a tenant scope around a synchronous call, used by the
 * authentication middleware to wrap `next()`.
 *
 * The scope covers everything the callback starts, including promises it
 * creates. It does not cover work awaited by the *caller* afterwards, which is
 * why the programmatic helpers below await inside the scope instead.
 */
export const withTenantScope = <T>(
  tenantId: string,
  context: Omit<RequestContext, 'tenantId' | 'isSystem'>,
  fn: () => T
): T => storage.run({ ...context, tenantId, isSystem: false }, fn);

/**
 * Run `fn` with tenant scoping disabled. Reserved for trusted internal work:
 * tenant onboarding, data migrations and CLI scripts.
 *
 * The result is awaited inside the scope so a lazily executed Mongoose query
 * returned by `fn` still runs with the scope active.
 */
export const withSystemScope = <T>(fn: () => T | PromiseLike<T>): Promise<T> =>
  storage.run({ tenantId: null, isSystem: true }, async () => fn());

/** Run `fn` scoped to one company, from a script or a cross-tenant service. */
export const runAsTenant = <T>(tenantId: string, fn: () => T | PromiseLike<T>): Promise<T> =>
  storage.run(
    { ...(storage.getStore() ?? { isSystem: false }), tenantId, isSystem: false },
    async () => fn()
  );

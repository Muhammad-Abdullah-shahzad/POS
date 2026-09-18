/**
 * Turning a bearer token into a tenant scoped request.
 *
 * `authenticate` verifies the JWT, confirms the company is in good standing,
 * confirms its licence is in force, and then runs the rest of the request
 * inside that tenant's scope. From this point on every model query is filtered
 * to the caller's company automatically.
 *
 * A handful of routes must keep working after the licence has run out — sign
 * out, "who am I", reading the licence status and pasting in a new key — or
 * the customer could never renew. Those use `authenticateWithoutLicense`.
 */
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ForbiddenError, LicenseRequiredError, UnauthorizedError } from '../core/errors';
import { UserRole, withTenantScope } from '../core/tenantContext';
import { CachedTenant } from '../core/tenantStatusCache';
import { verifyAccessToken } from '../services/tokenService';
import { getTenantStatus } from '../services/tenantService';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/** Kept for controllers that still type their handlers explicitly. */
export type AuthRequest = Request;

function readBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Authentication required');
  return token;
}

function assertTenantInGoodStanding(tenant: CachedTenant): void {
  if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
    throw new ForbiddenError(`${tenant.name} is not active. Contact support.`);
  }
}

/**
 * The licence gate for the web app. The desktop till performs the same check
 * offline against its cached key; this is what stops a browser session once
 * the operator lets a licence lapse.
 */
function assertLicensed(tenant: CachedTenant): void {
  if (!tenant.licenseExpiresAt) {
    throw new LicenseRequiredError(
      'LICENSE_MISSING',
      `${tenant.name} has no licence yet. Contact support to receive a licence key.`
    );
  }

  if (tenant.licenseExpiresAt.getTime() <= Date.now()) {
    throw new LicenseRequiredError(
      'LICENSE_EXPIRED',
      `The licence for ${tenant.name} expired on ${tenant.licenseExpiresAt.toISOString().slice(0, 10)}. Renew it to continue.`,
      { expiresAt: tenant.licenseExpiresAt.toISOString() }
    );
  }
}

function buildAuthenticate(options: { enforceLicense: boolean }) {
  return async function authenticateRequest(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = verifyAccessToken(readBearerToken(req));
      const tenant = await getTenantStatus(payload.tenantId);

      assertTenantInGoodStanding(tenant);
      if (options.enforceLicense) assertLicensed(tenant);

      req.user = {
        id: payload.sub,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantName: tenant.name,
      };
    } catch (error) {
      next(error);
      return;
    }

    // Everything downstream — controllers, services, models — runs pinned to
    // this tenant, so nothing else has to pass the id around. Called outside
    // the try/catch above so a downstream error is never reported twice.
    withTenantScope(
      req.user!.tenantId,
      { userId: req.user!.id, role: req.user!.role, requestId: req.requestId },
      () => next()
    );
  };
}

/** The default guard: a valid session, an active company and a licence in force. */
export const authenticate = buildAuthenticate({ enforceLicense: true });

/** Identity only. For the few routes that must work while the licence is expired. */
export const authenticateWithoutLicense = buildAuthenticate({ enforceLicense: false });

/** Restrict a route to specific roles. Always used after `authenticate`. */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`This action requires one of: ${roles.join(', ')}`));
      return;
    }
    next();
  };

/**
 * Guards platform level endpoints such as onboarding a new company. The key is
 * a server side secret; no browser client ever holds it.
 */
export function requirePlatformKey(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers['x-platform-key'];

  if (typeof provided !== 'string' || !timingSafeEquals(provided, env.platformApiKey)) {
    next(new UnauthorizedError('Invalid platform credentials'));
    return;
  }
  next();
}

/** Constant time comparison, so a wrong key cannot be found byte by byte. */
function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

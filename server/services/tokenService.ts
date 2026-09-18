/**
 * Issuing, verifying and rotating credentials.
 *
 * Access tokens are short lived JWTs carrying the tenant, so normal requests
 * need no database round trip. Refresh tokens are opaque, stored hashed, and
 * rotated on every use.
 */
import jwt, { SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { UnauthorizedError } from '../core/errors';
import { logger } from '../core/logger';
import { IUser, UserRole } from '../models/User';
import Session, { generateRefreshToken, hashRefreshToken } from '../models/Session';

export interface AccessTokenPayload {
  /** User id. Kept as `sub` to follow the JWT registered claim. */
  sub: string;
  tenantId: string;
  role: UserRole;
  /** Matches `User.tokenVersion`; a mismatch means the token was revoked. */
  ver: number;
}

export interface IssuedCredentials {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds, so clients can refresh ahead of expiry. */
  expiresIn: number;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

const REFRESH_TOKEN_TTL_MS = env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.auth.accessTokenSecret, {
    expiresIn: env.auth.accessTokenTtl,
    issuer: 'pos-api',
  } as SignOptions);

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.auth.accessTokenSecret, { issuer: 'pos-api' }) as AccessTokenPayload;
  } catch (error: any) {
    throw new UnauthorizedError(
      error?.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid authentication token'
    );
  }
}

/** Seconds until an access token expires, derived from the configured TTL. */
function accessTokenLifetimeSeconds(): number {
  const decoded = jwt.decode(signAccessToken({ sub: '0', tenantId: '0', role: 'cashier', ver: 0 })) as {
    exp: number;
    iat: number;
  };
  return decoded.exp - decoded.iat;
}

const ACCESS_TOKEN_LIFETIME = accessTokenLifetimeSeconds();

/** Start a new session: a fresh access token plus the first refresh token. */
export async function issueCredentials(user: IUser, metadata: SessionMetadata = {}): Promise<IssuedCredentials> {
  const refreshToken = generateRefreshToken();

  await Session.create({
    userId: user._id,
    tenantId: user.tenantId,
    tokenHash: hashRefreshToken(refreshToken),
    familyId: new Types.ObjectId().toString(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: metadata.userAgent ?? '',
    ipAddress: metadata.ipAddress ?? '',
  });

  return {
    accessToken: signAccessToken({
      sub: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: user.role,
      ver: user.tokenVersion,
    }),
    refreshToken,
    expiresIn: ACCESS_TOKEN_LIFETIME,
  };
}

export interface RotationResult extends IssuedCredentials {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
}

/**
 * Exchange a refresh token for a new pair, invalidating the old one.
 *
 * Presenting an already rotated token means the token was copied, so every
 * session descended from the same sign in is revoked.
 */
export async function rotateRefreshToken(
  rawToken: string,
  resolveUser: (userId: Types.ObjectId) => Promise<IUser | null>,
  metadata: SessionMetadata = {}
): Promise<RotationResult> {
  const session = await Session.findOne({ tokenHash: hashRefreshToken(rawToken) });

  if (!session) throw new UnauthorizedError('Invalid session, please sign in again');

  if (session.revokedAt) {
    logger.warn({ userId: session.userId, familyId: session.familyId }, 'Refresh token reuse detected');
    await Session.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw new UnauthorizedError('Session is no longer valid, please sign in again');
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Session expired, please sign in again');
  }

  const user = await resolveUser(session.userId);
  if (!user || !user.isActive) {
    await Session.updateMany({ familyId: session.familyId }, { $set: { revokedAt: new Date() } });
    throw new UnauthorizedError('Account is no longer active');
  }

  const nextToken = generateRefreshToken();

  session.revokedAt = new Date();
  await session.save();

  await Session.create({
    userId: user._id,
    tenantId: user.tenantId,
    tokenHash: hashRefreshToken(nextToken),
    familyId: session.familyId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: metadata.userAgent ?? session.userAgent,
    ipAddress: metadata.ipAddress ?? session.ipAddress,
  });

  return {
    accessToken: signAccessToken({
      sub: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: user.role,
      ver: user.tokenVersion,
    }),
    refreshToken: nextToken,
    expiresIn: ACCESS_TOKEN_LIFETIME,
    userId: user._id,
    tenantId: user.tenantId,
  };
}

/** End one device's session. Unknown tokens are ignored so sign out is idempotent. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await Session.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

/** Sign a user out everywhere, for example after a password change. */
export async function revokeAllSessionsForUser(userId: Types.ObjectId): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

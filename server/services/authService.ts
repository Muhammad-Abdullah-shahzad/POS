/**
 * Sign up, sign in, session refresh and password changes.
 *
 * Lookups by email cross the tenant boundary by necessity — the tenant is not
 * known until the account is found — so they run inside `withSystemScope()`.
 * Everything the caller receives afterwards is pinned to that one tenant.
 *
 * Sign in succeeds even when the company's licence has run out: the client
 * needs a session to show the renewal screen and to paste in a new key. Every
 * other request is then refused by the licence gate in `authenticate`.
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../core/errors';
import { withSystemScope } from '../core/tenantContext';
import User, { IUser, UserRole } from '../models/User';
import Tenant, { ITenant } from '../models/Tenant';
import { LicenseStatus, describeLicense } from './licenseService';
import { provisionTenant } from './tenantService';
import {
  IssuedCredentials,
  SessionMetadata,
  issueCredentials,
  revokeAllSessionsForUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from './tokenService';

export interface AuthenticatedProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

export interface AuthResult extends IssuedCredentials {
  user: AuthenticatedProfile;
  license: LicenseStatus;
}

export interface RegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

type TenantSummary = Pick<ITenant, 'name' | 'status' | 'license'> & { _id: Types.ObjectId };

const TENANT_FIELDS = 'name status license';

const toProfile = (user: IUser, tenant: TenantSummary): AuthenticatedProfile => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  tenantId: tenant._id.toString(),
  tenantName: tenant.name,
});

const toAuthResult = (credentials: IssuedCredentials, user: IUser, tenant: TenantSummary): AuthResult => ({
  ...credentials,
  user: toProfile(user, tenant),
  license: describeLicense(tenant.license),
});

function assertTenantUsable(tenant: { status: string; name: string }): void {
  if (tenant.status === 'suspended') {
    throw new ForbiddenError(`${tenant.name} is suspended. Contact support to reactivate the account.`);
  }
  if (tenant.status === 'cancelled') {
    throw new ForbiddenError(`${tenant.name} is closed.`);
  }
}

/**
 * Public sign up: a new company with its first admin, signed in straight away.
 * The company starts on the configured trial licence.
 */
export async function register(input: RegisterInput, metadata: SessionMetadata = {}): Promise<AuthResult> {
  if (!env.publicSignupEnabled) {
    throw new NotFoundError('Sign up');
  }

  const { tenant, admin } = await provisionTenant({
    company: {
      name: input.companyName,
      contactEmail: input.email,
      contactPhone: input.phone,
    },
    admin: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  const credentials = await issueCredentials(admin, metadata);
  return toAuthResult(credentials, admin, tenant);
}

export async function login(
  email: string,
  password: string,
  metadata: SessionMetadata = {}
): Promise<AuthResult> {
  return withSystemScope(async () => {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

    // The same message for an unknown email and a wrong password, so the
    // endpoint cannot be used to discover which accounts exist.
    const invalid = new UnauthorizedError('Invalid email or password');
    if (!user) {
      throw invalid;
    }

    const passwordMatches = await user.verifyPassword(password);
    if (!passwordMatches) throw invalid;
    if (!user.isActive) throw new ForbiddenError('This account has been disabled');

    const tenant = await Tenant.findById(user.tenantId).select(TENANT_FIELDS);
    if (!tenant) throw new UnauthorizedError('The company for this account no longer exists');
    assertTenantUsable(tenant);

    const credentials = await issueCredentials(user, metadata);

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return toAuthResult(credentials, user, tenant);
  });
}

export async function refreshSession(
  refreshToken: string,
  metadata: SessionMetadata = {}
): Promise<AuthResult> {
  return withSystemScope(async () => {
    const rotated = await rotateRefreshToken(
      refreshToken,
      (userId) => User.findById(userId).exec(),
      metadata
    );

    const [user, tenant] = await Promise.all([
      User.findById(rotated.userId),
      Tenant.findById(rotated.tenantId).select(TENANT_FIELDS),
    ]);

    if (!user || !tenant) throw new UnauthorizedError('Session is no longer valid');
    assertTenantUsable(tenant);

    return toAuthResult(
      { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken, expiresIn: rotated.expiresIn },
      user,
      tenant
    );
  });
}

export const logout = (refreshToken: string): Promise<void> => revokeRefreshToken(refreshToken);

/**
 * Change a signed in user's own password. Every existing session is revoked so
 * a stolen token stops working the moment the password is rotated.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new UnauthorizedError('Account not found');

  const matches = await user.verifyPassword(currentPassword);
  if (!matches) throw new BadRequestError('Current password is incorrect');

  await user.setPassword(newPassword);
  await user.save();
  await revokeAllSessionsForUser(user._id);
}

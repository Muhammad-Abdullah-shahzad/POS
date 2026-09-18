/**
 * Sign up, sign in, session refresh, sign out and "who am I".
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { UnauthorizedError } from '../core/errors';
import * as authService from '../services/authService';
import { AuthResult } from '../services/authService';
import { getLicenseStatus } from '../services/licenseService';
import { SessionMetadata } from '../services/tokenService';

const sessionMetadata = (req: Request): SessionMetadata => ({
  userAgent: req.get('user-agent') ?? '',
  ipAddress: req.ip ?? '',
});

/** The one response shape every sign in style endpoint returns. */
const sessionPayload = (result: AuthResult) => ({
  // `token` is kept alongside `accessToken` so older desktop builds that read
  // the original field keep working.
  token: result.accessToken,
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  expiresIn: result.expiresIn,
  user: result.user,
  license: result.license,
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, sessionMetadata(req));

  res.status(201).json(successResponse(sessionPayload(result), `${result.user.tenantName} is ready`));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, sessionMetadata(req));

  res.json(successResponse(sessionPayload(result), 'Signed in'));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshSession(req.body.refreshToken, sessionMetadata(req));

  res.json(successResponse(sessionPayload(result), 'Session refreshed'));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.body?.refreshToken;
  if (refreshToken) await authService.logout(refreshToken);
  res.json(successResponse(null, 'Signed out'));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();

  res.json(
    successResponse({
      id: req.user.id,
      role: req.user.role,
      tenantId: req.user.tenantId,
      tenantName: req.user.tenantName,
      license: await getLicenseStatus(req.user.tenantId),
    })
  );
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();

  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json(successResponse(null, 'Password changed. Please sign in again.'));
});

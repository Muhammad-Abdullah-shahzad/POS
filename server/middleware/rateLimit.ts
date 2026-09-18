/**
 * Rate limits.
 *
 * Sign in is limited per IP and email so a stolen password list cannot be tried
 * at speed; the rest of the API gets a broad ceiling that protects the process
 * without getting in a busy shop's way.
 */
import rateLimit, { Options, ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../config/env';
import { errorResponse } from '../core/apiResponse';

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Limits get in the way of local development and tests.
  skip: () => !env.isProduction,
  handler: (req: Request, res) => {
    res
      .status(429)
      .json(errorResponse('Too many requests, please slow down', 'TOO_MANY_REQUESTS', undefined, req.requestId));
  },
};

export const apiRateLimit = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 600,
});

export const authRateLimit = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 10,
  // Counting the email as well as the IP stops one shared shop connection from
  // being locked out by an attack on a different account. `ipKeyGenerator`
  // normalises IPv6 so an attacker cannot rotate through a subnet.
  keyGenerator: (req: Request) =>
    `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`,
});

export const onboardingRateLimit = rateLimit({
  ...shared,
  windowMs: 60 * 60_000,
  limit: 30,
});

import pino from 'pino';
import { env } from '../config/env';

/**
 * Structured application logger. Pretty printing is intentionally left to the
 * consumer (`npm run dev | npx pino-pretty`) so production logs stay as
 * machine readable JSON.
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: 'pos-api', env: env.nodeEnv },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-platform-key"]',
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'refreshToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
});

export type Logger = typeof logger;

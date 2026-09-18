/**
 * Validated application configuration.
 *
 * Every environment variable the server needs is declared, coerced and checked
 * here exactly once, at boot. A missing or malformed value stops the process
 * immediately instead of surfacing as an obscure runtime failure later.
 */
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const csv = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Shared secret that guards tenant onboarding endpoints. */
  PLATFORM_API_KEY: z.string().min(16, 'PLATFORM_API_KEY must be at least 16 characters'),

  /**
   * Ed25519 key pair that signs and verifies licence keys. Generate once with
   * `npm run license:keys`. The public half also ships inside the desktop app.
   */
  LICENSE_SIGNING_KEY: z.string().min(1, 'LICENSE_SIGNING_KEY is required (generate with: npm run license:keys)'),
  LICENSE_PUBLIC_KEY: z.string().min(1, 'LICENSE_PUBLIC_KEY is required (generate with: npm run license:keys)'),
  /** Days of free use a self-registered company gets. 0 means "locked until a key is issued". */
  LICENSE_TRIAL_DAYS: z.coerce.number().int().min(0).max(365).default(14),
  /** Set to false to turn off the public sign up form and onboard customers by hand only. */
  PUBLIC_SIGNUP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  /** Comma separated list of allowed browser origins. Empty means "allow all". */
  CORS_ORIGINS: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse({
  ...process.env,
  // Backwards compatible aliases for the original Google Drive variable names.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? process.env.CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? process.env.CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ?? process.env.REFRESH_TOKEN,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${details}\n\nSee .env.example for the full list.`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  logLevel: raw.LOG_LEVEL,

  mongoUri: raw.MONGO_URI,

  auth: {
    accessTokenSecret: raw.JWT_SECRET,
    refreshTokenSecret: raw.JWT_REFRESH_SECRET,
    accessTokenTtl: raw.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,
  },

  platformApiKey: raw.PLATFORM_API_KEY,

  license: {
    signingKey: raw.LICENSE_SIGNING_KEY,
    publicKey: raw.LICENSE_PUBLIC_KEY,
    trialDays: raw.LICENSE_TRIAL_DAYS,
  },

  publicSignupEnabled: raw.PUBLIC_SIGNUP_ENABLED,

  corsOrigins: csv(raw.CORS_ORIGINS),

  googleDrive: {
    clientId: raw.GOOGLE_CLIENT_ID,
    clientSecret: raw.GOOGLE_CLIENT_SECRET,
    refreshToken: raw.GOOGLE_REFRESH_TOKEN,
    isConfigured: Boolean(raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET && raw.GOOGLE_REFRESH_TOKEN),
  },
} as const;

export type AppConfig = typeof env;

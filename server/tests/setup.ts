/**
 * Test bootstrap.
 *
 * Points the process at a throwaway database before any module reads the
 * config, connects once for the whole run and clears collections between
 * files so tests never inherit each other's rows.
 */
import { afterAll, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { generateLicenseKeyPair } from '../core/license';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27017/pos_system_test';
process.env.JWT_SECRET ??= 'test-access-secret-that-is-long-enough-1234';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-1234';
process.env.PLATFORM_API_KEY ??= 'test-platform-key-1234567890';

// A throwaway signing pair per run, so the suite never depends on a real one.
if (!process.env.LICENSE_SIGNING_KEY || !process.env.LICENSE_PUBLIC_KEY) {
  const pair = generateLicenseKeyPair();
  process.env.LICENSE_SIGNING_KEY = pair.privateKey;
  process.env.LICENSE_PUBLIC_KEY = pair.publicKey;
}
process.env.LOG_LEVEL ??= 'silent';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

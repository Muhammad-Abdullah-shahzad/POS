/**
 * MongoDB connection lifecycle.
 */
import mongoose, { ClientSession } from 'mongoose';
import { env } from './env';
import { logger } from '../core/logger';

mongoose.set('strictQuery', true);
// Indexes are created by `npm run db:indexes`, never implicitly on boot, so a
// deploy cannot stall behind an index build.
mongoose.set('autoIndex', false);

/**
 * Transactions need a replica set or a sharded cluster. A standalone mongod —
 * common in development and small single-server deployments — rejects them, so
 * support is probed once at connect time instead of failing on first write.
 */
let transactionsSupported = false;

async function probeTransactionSupport(): Promise<void> {
  try {
    const info = await mongoose.connection.db!.admin().command({ hello: 1 });
    transactionsSupported = Boolean(info.setName) || info.msg === 'isdbgrid';
  } catch {
    transactionsSupported = false;
  }

  logger.info({ transactions: transactionsSupported }, 'MongoDB capability probe');
}

export async function connectDB(): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB connection error'));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 25,
    minPoolSize: 2,
  });

  await probeTransactionSupport();

  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
}

/** True when the deployment supports multi document transactions. */
export const supportsTransactions = (): boolean => transactionsSupported;

/**
 * Run `work` inside a transaction when the deployment supports one, and plainly
 * when it does not.
 *
 * Because the no-transaction path is real — a standalone mongod cannot roll
 * back — `work` must stay safe to retry after a partial failure.
 */
export async function withTransaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!transactionsSupported) return work(undefined);

  const session = await mongoose.startSession();

  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

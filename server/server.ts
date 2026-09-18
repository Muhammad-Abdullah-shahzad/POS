/**
 * Process entry point: connect, listen, and shut down cleanly.
 */
import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { logger } from './core/logger';

async function bootstrap(): Promise<void> {
  await connectDB();

  const server = createApp().listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'POS API listening');
  });

  // Finish in-flight requests before closing the database, so a deploy or a
  // container restart never cuts a sale in half.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');

    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception, exiting');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start the server');
  process.exit(1);
});

/**
 * Express application wiring.
 *
 * Kept separate from `server.ts` so tests can build the app without opening a
 * port or connecting to a database.
 */
import path from 'path';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRateLimit } from './middleware/rateLimit';
import { httpLogger, requestId } from './middleware/requestContext';
import apiRoutes from './routes';

export function createApp(): Application {
  const app = express();

  // Behind a proxy (Nginx, Render, Fly) the client IP arrives in a header, and
  // rate limiting needs the real one.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(httpLogger);

  app.use(
    helmet({
      // Product images are loaded by the browser client from a different origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      // An empty allowlist keeps local development and the packaged desktop app
      // working; production should always set CORS_ORIGINS.
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Product images. File names carry a random suffix, so a URL cannot be
  // guessed from a product id.
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: '7d',
      index: false,
      dotfiles: 'ignore',
    })
  );

  app.use('/api', apiRateLimit, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

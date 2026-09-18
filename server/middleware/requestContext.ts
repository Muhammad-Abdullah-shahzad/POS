import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../core/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlates every log line and error response for one request. */
      requestId: string;
    }
  }
}

/** Attach a request id before logging so it appears on every line. */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).requestId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Health checks would otherwise dominate the log volume.
  autoLogging: { ignore: (req) => req.url === '/api/health' },
});

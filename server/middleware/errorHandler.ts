/**
 * The one place HTTP error responses are produced.
 *
 * Known failures keep their message and status. Anything unexpected — including
 * a missing tenant scope, which is always a bug — is logged in full and
 * reported as a generic 500, so internals never reach the client.
 */
import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { MongoServerError } from 'mongodb';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { errorResponse } from '../core/apiResponse';
import { AppError, NotFoundError, TenantScopeError } from '../core/errors';
import { logger } from '../core/logger';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  /** Unexpected failures are logged at error level with the full stack. */
  unexpected: boolean;
}

const DUPLICATE_KEY = 11000;

function normalize(error: unknown): NormalizedError {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
      unexpected: false,
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid',
      details: Object.values(error.errors).map((issue) => ({
        field: issue.path,
        message: issue.message,
      })),
      unexpected: false,
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      code: 'INVALID_IDENTIFIER',
      message: `'${error.value}' is not a valid ${error.path}`,
      unexpected: false,
    };
  }

  if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
    const field = Object.keys(error.keyPattern ?? {}).filter((key) => key !== 'tenantId')[0] ?? 'value';
    return {
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: `That ${field} is already in use`,
      unexpected: false,
    };
  }

  if (error instanceof TenantScopeError) {
    return {
      statusCode: 500,
      code: 'TENANT_SCOPE_MISSING',
      message: 'Internal server error',
      unexpected: true,
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    unexpected: true,
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalize(error);
  const context = {
    err: error,
    requestId: req.requestId,
    tenantId: req.user?.tenantId,
    userId: req.user?.id,
    path: req.originalUrl,
    method: req.method,
  };

  if (normalized.unexpected) {
    logger.error(context, 'Unhandled request failure');
  } else {
    logger.warn(context, normalized.message);
  }

  res.status(normalized.statusCode).json(
    errorResponse(
      normalized.message,
      normalized.code,
      // Stack traces are useful locally and dangerous in production.
      normalized.unexpected && !env.isProduction
        ? { stack: (error as Error)?.stack }
        : normalized.details,
      req.requestId
    )
  );
};

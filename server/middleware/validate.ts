/**
 * Request validation.
 *
 * Handlers receive data that has already been parsed, coerced and narrowed, so
 * they never repeat `typeof x === 'string'` checks or trust raw input.
 */
import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { ValidationError } from '../core/errors';

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

const formatIssues = (error: { issues: Array<{ path: PropertyKey[]; message: string }> }) =>
  error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));

export const validate =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    for (const source of ['body', 'query', 'params'] as const) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (!result.success) {
        next(new ValidationError(`Invalid request ${source}`, formatIssues(result.error)));
        return;
      }

      // Express 5 exposes `query` as a getter, so the parsed value is stored
      // separately instead of being assigned back onto the request.
      if (source === 'query') {
        req.validatedQuery = result.data as Record<string, unknown>;
      } else {
        req[source] = result.data as never;
      }
    }
    next();
  };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Query parameters after validation and coercion. */
      validatedQuery?: Record<string, unknown>;
    }
  }
}

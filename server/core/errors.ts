/**
 * Application error types.
 *
 * Controllers and services throw these instead of writing HTTP responses by
 * hand; the central error handler turns them into the API response envelope.
 * Anything that is not an AppError is treated as an unexpected failure and is
 * reported as a 500 without leaking internals to the client.
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  /** Expected errors are safe to show to the caller; unexpected ones are not. */
  readonly isOperational = true;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export type LicenseFailure = 'LICENSE_EXPIRED' | 'LICENSE_MISSING';

/**
 * The company's licence has run out or was never issued. Reported as 402 so
 * clients can tell "pay us" apart from "you are not allowed" (403) and show the
 * renewal screen instead of a permission error.
 */
export class LicenseRequiredError extends AppError {
  constructor(code: LicenseFailure, message: string, details?: unknown) {
    super(message, 402, code, details);
  }
}

/** A pasted licence key that cannot be applied: forged, damaged or for another company. */
export class InvalidLicenseKeyError extends AppError {
  constructor(message = 'This licence key cannot be used') {
    super(message, 422, 'LICENSE_KEY_INVALID');
  }
}

/**
 * Raised when a tenant scoped query runs without a tenant in context. It always
 * indicates a programming error, never bad user input, so it is logged loudly
 * and reported as a 500.
 */
export class TenantScopeError extends Error {
  constructor(modelName: string, operation: string) {
    super(
      `Tenant scope missing for ${modelName}.${operation}(). ` +
        'Run the operation inside withTenantScope() or withSystemScope().'
    );
    this.name = 'TenantScopeError';
  }
}

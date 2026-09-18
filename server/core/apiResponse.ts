/**
 * The single response envelope every endpoint returns.
 *
 * Kept backwards compatible with the original `{ success, data, message }`
 * shape so existing clients keep working.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiFailure {
  success: false;
  data: null;
  message: string;
  code: string;
  details?: unknown;
  requestId?: string;
}

export const successResponse = <T>(data: T, message = 'Success'): ApiSuccess<T> => ({
  success: true,
  data,
  message,
});

export const errorResponse = (
  message: string,
  code = 'ERROR',
  details?: unknown,
  requestId?: string
): ApiFailure => ({
  success: false,
  data: null,
  message,
  code,
  ...(details !== undefined && { details }),
  ...(requestId && { requestId }),
});

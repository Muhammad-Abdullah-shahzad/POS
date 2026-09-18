import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so a rejected promise reaches the Express error
 * handler instead of hanging the request. Without it every controller needs its
 * own try/catch purely to forward errors.
 */
export const asyncHandler =
  <Req extends Request = Request>(handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as unknown as Req, res, next)).catch(next);
  };

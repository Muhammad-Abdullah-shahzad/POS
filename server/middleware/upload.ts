/**
 * File uploads that keep the request's company scope.
 *
 * Upload parsers read the request as a stream and call back from stream
 * events, which run outside the scope the authentication middleware set up.
 * Without this, tenant-scoped models refuse to run in the controller that
 * follows. Wrap every upload middleware with it:
 *
 *   router.post('/', keepingScope(productImageUpload.single('image')), createProduct);
 */
import type { RequestHandler } from 'express';
import { getContext, resumeContext } from '../core/tenantContext';

export const keepingScope =
  (upload: RequestHandler): RequestHandler =>
  (req, res, next) => {
    const context = getContext();
    upload(req, res, (error?: unknown) => (context ? resumeContext(context, () => next(error)) : next(error)));
  };

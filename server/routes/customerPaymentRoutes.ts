/**
 * Customer payment ledger routes.
 *
 * The main CRUD for payments lives on the customer routes
 * (POST /customers/:id/payments, GET /customers/:id/ledger).
 *
 * This file exposes a flat GET /customer-payments endpoint so the
 * desktop app can pull the full payments collection during sync.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../core/asyncHandler';
import { successResponse } from '../core/apiResponse';
import CustomerPayment from '../models/CustomerPayment';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const payments = await CustomerPayment.find().sort({ createdAt: -1 }).lean();
    res.json(successResponse(payments));
  })
);

export default router;

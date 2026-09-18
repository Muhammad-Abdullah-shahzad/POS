import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createOrderSchema, orderListQuery, voidOrderSchema } from '../validators/orderValidators';
import { createOrder, getOrders, getVoidedOrders, voidOrder } from '../controllers/orderController';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate({ query: orderListQuery }), getOrders)
  .post(validate({ body: createOrderSchema }), createOrder);

router.get('/voided', getVoidedOrders);

// Voiding is a DELETE so the till's existing call keeps working; the order
// itself is never removed, only marked voided with its stock returned.
router.delete('/:id', validate({ params: idParam, query: voidOrderSchema }), voidOrder);

export default router;

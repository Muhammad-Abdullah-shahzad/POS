/**
 * Product returns: against a recorded sale, or open (no sale, no customer).
 * Cashiers take returns at the till, so every signed in role may record one.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createReturnSchema, returnListQuery } from '../validators/orderValidators';
import { createProductReturn, getReturnableSale, getReturns } from '../controllers/returnController';

const router = Router();

router.use(authenticate);

router.route('/').get(validate({ query: returnListQuery }), getReturns).post(validate({ body: createReturnSchema }), createProductReturn);
router.get('/sale/:id', validate({ params: idParam }), getReturnableSale);

export default router;

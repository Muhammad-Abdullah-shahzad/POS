import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createUserSchema, updateUserSchema } from '../validators/authValidators';
import { createUser, deleteUser, listUsers, updateUser } from '../controllers/userController';

const router = Router();

// Staff administration is an admin-only area of each company.
router.use(authenticate, authorize('admin'));

router.route('/').get(listUsers).post(validate({ body: createUserSchema }), createUser);

router
  .route('/:id')
  .patch(validate({ params: idParam, body: updateUserSchema }), updateUser)
  .delete(validate({ params: idParam }), deleteUser);

export default router;

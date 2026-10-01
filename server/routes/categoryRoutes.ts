import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createCategorySchema, updateCategorySchema } from '../validators/catalogValidators';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../controllers/categoryController';

const router = Router();

router.use(authenticate);

router.route('/').get(getCategories).post(validate({ body: createCategorySchema }), createCategory);

router
  .route('/:id')
  .put(validate({ params: idParam, body: updateCategorySchema }), updateCategory)
  // Cashiers manage categories too, so deleting is open to every signed in role.
  .delete(validate({ params: idParam }), deleteCategory);

export default router;

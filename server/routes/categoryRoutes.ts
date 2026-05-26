import express from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(getCategories)
  .post(protect, createCategory);

router.route('/:id')
  .put(protect, updateCategory)
  .delete(protect, deleteCategory);

export default router;

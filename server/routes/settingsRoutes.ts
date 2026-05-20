import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(getSettings)
  .put(protect, authorize('admin'), updateSettings);

export default router;

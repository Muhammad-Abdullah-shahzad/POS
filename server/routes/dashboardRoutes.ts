import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.get('/stats', protect, authorize('admin', 'manager'), getDashboardStats);

export default router;

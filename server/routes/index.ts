/**
 * API surface.
 *
 * Everything below `/api` is mounted here, so the entry point stays a thin
 * bootstrap and the route table can be read in one place.
 */
import { Router } from 'express';
import { successResponse } from '../core/apiResponse';
import analyticsRoutes from './analyticsRoutes';
import authRoutes from './authRoutes';
import bankRoutes from './bankRoutes';
import categoryRoutes from './categoryRoutes';
import customerRoutes from './customerRoutes';
import dashboardRoutes from './dashboardRoutes';
import employeeDamageRoutes from './employeeDamageRoutes';
import employeeRoutes from './employeeRoutes';
import expenseCategoryRoutes from './expenseCategoryRoutes';
import expenseRoutes from './expenseRoutes';
import licenseRoutes from './licenseRoutes';
import orderRoutes from './orderRoutes';
import platformRoutes from './platformRoutes';
import productRoutes from './productRoutes';
import settingsRoutes from './settingsRoutes';
import supplierRoutes from './supplierRoutes';
import syncRoutes from './syncRoutes';
import userRoutes from './userRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json(successResponse({ status: 'ok', uptime: Math.round(process.uptime()) }));
});

// Platform administration — guarded by the operator key, not a user session.
router.use('/platform', platformRoutes);

router.use('/auth', authRoutes);
// Reachable with an expired licence, so a company can renew from inside the app.
router.use('/license', licenseRoutes);
router.use('/users', userRoutes);

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', orderRoutes);
router.use('/customers', customerRoutes);
router.use('/employees', employeeRoutes);
router.use('/employee-damages', employeeDamageRoutes);
router.use('/expenses', expenseRoutes);
router.use('/expense-categories', expenseCategoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/banks', bankRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);

// Desktop sync lives at the collection root, e.g. /api/products/sync.
router.use('/', syncRoutes);

export default router;

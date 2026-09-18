/**
 * Platform routes — onboarding, account administration and licences.
 *
 * Authenticated with the `x-platform-key` header, which only the operator
 * holds. No browser client ever calls these.
 *
 *   GET   /api/platform/tenants                 every company with its licence
 *   POST  /api/platform/tenants                 onboard a company by hand
 *   PATCH /api/platform/tenants/:id/status      suspend, reactivate, cancel
 *   GET   /api/platform/tenants/:id/license     current licence
 *   POST  /api/platform/tenants/:id/license     issue or extend, returns the key
 */
import { Router } from 'express';
import { requirePlatformKey } from '../middleware/authenticate';
import { onboardingRateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { provisionTenantSchema, tenantStatusSchema } from '../validators/authValidators';
import { issueLicenseSchema } from '../validators/licenseValidators';
import {
  getTenantLicense,
  issueTenantLicense,
  listTenants,
  provisionTenant,
  updateTenantStatus,
} from '../controllers/platformController';

const router = Router();

router.use(requirePlatformKey, onboardingRateLimit);

router.route('/tenants').get(listTenants).post(validate({ body: provisionTenantSchema }), provisionTenant);

router.patch('/tenants/:id/status', validate({ params: idParam, body: tenantStatusSchema }), updateTenantStatus);

router
  .route('/tenants/:id/license')
  .get(validate({ params: idParam }), getTenantLicense)
  .post(validate({ params: idParam, body: issueLicenseSchema }), issueTenantLicense);

export default router;

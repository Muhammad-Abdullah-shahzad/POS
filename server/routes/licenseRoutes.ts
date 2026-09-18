/**
 * Licence routes for a signed in company.
 *
 *   GET  /api/license           current status (state, expiry, key)
 *   POST /api/license/activate  apply a key the operator sent
 *
 * Deliberately not gated on the licence itself.
 */
import { Router } from 'express';
import { authenticateWithoutLicense } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { activateLicenseSchema } from '../validators/licenseValidators';
import { activateLicense, getLicense } from '../controllers/licenseController';

const router = Router();

router.use(authenticateWithoutLicense);

router.get('/', getLicense);
router.post('/activate', validate({ body: activateLicenseSchema }), activateLicense);

export default router;

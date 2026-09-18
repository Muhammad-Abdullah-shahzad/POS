import { Router } from 'express';
import { authenticateWithoutLicense } from '../middleware/authenticate';
import { authRateLimit, onboardingRateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from '../validators/authValidators';
import { changePassword, login, logout, me, refresh, register } from '../controllers/authController';

const router = Router();

// Public sign up. Rate limited like onboarding, because it creates a company.
router.post('/register', onboardingRateLimit, validate({ body: registerSchema }), register);

router.post('/login', authRateLimit, validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refresh);
router.post('/logout', logout);

// These must keep working with an expired licence so the renewal screen can
// show who is signed in and let them change a password meanwhile.
router.get('/me', authenticateWithoutLicense, me);
router.post('/change-password', authenticateWithoutLicense, validate({ body: changePasswordSchema }), changePassword);

export default router;

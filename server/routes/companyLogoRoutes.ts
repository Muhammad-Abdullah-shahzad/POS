import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { keepingScope } from '../middleware/upload';
import { deleteCompanyLogo, getCompanyLogo, uploadCompanyLogo } from '../controllers/companyLogoController';
import { logoImageUpload } from '../services/companyLogoService';

const router = Router();
const admins = authorize('admin');

router.use(authenticate);

// Every signed-in user reads the logo, so invoices show it on every till.
router.get('/', getCompanyLogo);
// Only the company's admin changes it. The operator can also use `npm run logo:set`.
router.post('/', admins, keepingScope(logoImageUpload.single('logo')), uploadCompanyLogo);
router.delete('/', admins, deleteCompanyLogo);

export default router;

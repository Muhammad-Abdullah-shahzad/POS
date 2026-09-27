import { Router } from 'express';
import { getDriveImage } from '../controllers/imageController';

const router = Router();

// No sign-in: browsers load these straight into <img> tags.
router.get('/drive/:fileId', getDriveImage);

export default router;

import express from 'express';
import { login, register } from '../controllers/authController';

const router = express.Router();

router.post('/login', login);
router.post('/register', register); // Setup a default user or protect with admin later

export default router;

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { successResponse, errorResponse } from '../utils/response';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json(errorResponse('Invalid credentials'));
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json(errorResponse('Invalid credentials'));
      return;
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '1d',
    });

    res.json(successResponse({ token, user: { id: user._id, name: user.name, role: user.role } }, 'Login successful'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json(errorResponse('User already exists'));
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, passwordHash, role: role || 'cashier' });
    res.status(201).json(successResponse({ id: user._id, name: user.name, role: user.role }, 'User created'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

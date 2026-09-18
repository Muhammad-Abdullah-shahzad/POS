/**
 * Staff accounts inside one company.
 *
 * Every query here is tenant scoped by the model plugin, so an admin can only
 * ever see and manage logins belonging to their own company.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { BadRequestError, ConflictError, NotFoundError } from '../core/errors';
import { withSystemScope } from '../core/tenantContext';
import User, { hashPassword } from '../models/User';
import { revokeAllSessionsForUser } from '../services/tokenService';

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().sort({ name: 1 });
  res.json(successResponse(users));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  // Emails are unique across the platform, so the check has to look past the
  // current tenant — otherwise the insert fails with a raw duplicate key error.
  const taken = await withSystemScope(() => User.exists({ email }));
  if (taken) throw new ConflictError('That email address already has an account');

  const user = await User.create({
    name,
    email,
    role,
    passwordHash: await hashPassword(password),
  });

  res.status(201).json(successResponse(user, 'Staff account created'));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, role, isActive, password } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('Staff account');

  // A company must keep at least one active admin, or nobody can administer it.
  const losingAdmin = user.role === 'admin' && (role !== undefined && role !== 'admin' || isActive === false);
  if (losingAdmin) {
    const otherAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: 'admin',
      isActive: true,
    });
    if (otherAdmins === 0) {
      throw new BadRequestError('This is the last active admin. Promote another user first.');
    }
  }

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (password) await user.setPassword(password);

  await user.save();

  // A disabled account or a reset password must not keep a live session.
  if (password || isActive === false) await revokeAllSessionsForUser(user._id);

  res.json(successResponse(user, 'Staff account updated'));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.id === req.params.id) {
    throw new BadRequestError('You cannot delete your own account');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('Staff account');

  if (user.role === 'admin') {
    const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', isActive: true });
    if (otherAdmins === 0) {
      throw new BadRequestError('This is the last active admin. Promote another user first.');
    }
  }

  await user.deleteOne();
  await revokeAllSessionsForUser(user._id);

  res.json(successResponse(null, 'Staff account removed'));
});

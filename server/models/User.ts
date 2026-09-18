/**
 * User — a login belonging to exactly one tenant.
 *
 * Email is unique platform wide so sign in needs nothing but an email and a
 * password; the tenant is derived from the account, never from user input.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { tenantScopePlugin } from './plugins/tenantScope';

export const USER_ROLES = ['admin', 'manager', 'cashier'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const BCRYPT_ROUNDS = 12;

export interface IUser extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  /**
   * Bumped to invalidate every issued token for this user, for example on a
   * password change or when the account is disabled.
   */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  verifyPassword(plainPassword: string): Promise<boolean>;
  setPassword(plainPassword: string): Promise<void>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'A valid email address is required'],
    },
    // Never returned by default — a query must ask for it explicitly.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: 'cashier' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.plugin(tenantScopePlugin);

// Staff lists are always read per company.
UserSchema.index({ tenantId: 1, role: 1 });

UserSchema.methods.verifyPassword = function (this: IUser, plainPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

UserSchema.methods.setPassword = async function (this: IUser, plainPassword: string): Promise<void> {
  this.passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  this.tokenVersion += 1;
};

export const hashPassword = (plainPassword: string): Promise<string> =>
  bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

export const User = mongoose.model<IUser>('User', UserSchema);
export default User;

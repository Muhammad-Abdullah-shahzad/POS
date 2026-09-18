/**
 * Session — one refresh token issued to one device.
 *
 * Refresh tokens are opaque random strings; only their SHA-256 hash is stored,
 * so a database leak does not hand out usable tokens. Each refresh rotates the
 * token and revokes the previous one. Presenting an already rotated token means
 * it was copied, so the whole family is revoked and the device must sign in
 * again.
 *
 * Not tenant scoped: sessions are looked up before a tenant context exists.
 * Every lookup is keyed by the token hash, which is unguessable.
 */
import crypto from 'crypto';
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISession extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  tenantId: Types.ObjectId;
  tokenHash: string;
  /** Groups every token rotated from one sign in, so theft revokes the chain. */
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true }
);

// MongoDB removes expired sessions on its own; no cleanup job needed.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateRefreshToken = (): string => crypto.randomBytes(48).toString('base64url');

export const Session = mongoose.model<ISession>('Session', SessionSchema);
export default Session;

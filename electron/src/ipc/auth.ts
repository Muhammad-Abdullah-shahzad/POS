/**
 * auth.ts — Local authentication IPC handlers
 *
 * Uses Node's built-in crypto (pbkdf2) for password hashing.
 * No native addons — works on any Node version.
 *
 * Default admin seeded on first launch:
 *   email:    admin@pos.com
 *   password: admin123
 *   role:     admin
 */

import { ipcMain } from 'electron';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun, generateLocalId, now, v } from '../db/database';

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers  (pbkdf2 — no bcrypt, no native compilation)
// ─────────────────────────────────────────────────────────────────────────────

const ITERATIONS = 100_000;
const KEY_LEN    = 64;
const DIGEST     = 'sha512';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch {
    return false;
  }
}

/** 
 * Standard JWT signed with HS256 to be compatible with the remote web server.
 * The remote server uses process.env.JWT_SECRET || 'your_jwt_secret_key' 
 */
function base64url(str: string | Buffer): string {
  return (typeof str === 'string' ? Buffer.from(str) : str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateToken(userId: string, role: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (30 * 24 * 60 * 60); // 30 days
  const payload = { id: userId, role, iat, exp };
  
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  // Must match the server's secret for sync to work
  const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
  
  const signature = crypto.createHmac('sha256', secret)
                          .update(unsignedToken)
                          .digest();
                          
  return `${unsignedToken}.${base64url(signature)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed default admin on first launch
// ─────────────────────────────────────────────────────────────────────────────

export function seedDefaultAdmin(): void {
  const existing = dbGet('SELECT _id FROM users LIMIT 1');
  if (existing) return; // already seeded

  const _id = generateLocalId();
  const ts  = now();
  dbRun(
    `INSERT INTO users (_id, name, email, passwordHash, role, createdAt, updatedAt, isSync)
     VALUES ($id, $name, $email, $passwordHash, $role, $ts, $ts, 0)`,
    {
      $id:           _id,
      $name:         'Admin',
      $email:        'admin@pos.com',
      $passwordHash: hashPassword('admin123'),
      $role:         'admin',
      $ts:           ts,
    }
  );
  console.log('[Auth] Default admin seeded  →  admin@pos.com / admin123');
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers
// ─────────────────────────────────────────────────────────────────────────────

export function registerAuthHandlers(): void {

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', (_e, email: string, password: string) => {
    const user = dbGet('SELECT * FROM users WHERE email = $email', { $email: email }) as any;

    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    if (!verifyPassword(password, user.passwordHash as string)) {
      return { success: false, message: 'Invalid credentials' };
    }

    const token = generateToken(user._id as string, user.role as string);

    return {
      success: true,
      data: {
        token,
        user: { id: user._id, name: user.name, role: user.role },
      },
    };
  });

  // ── REGISTER ──────────────────────────────────────────────────────────────
  ipcMain.handle('auth:register', (_e, data: { name: string; email: string; password: string; role: string }) => {
    const existing = dbGet('SELECT _id FROM users WHERE email = $email', { $email: data.email });
    if (existing) {
      return { success: false, message: 'User already exists' };
    }

    const _id = generateLocalId();
    const ts  = now();
    dbRun(
      `INSERT INTO users (_id, name, email, passwordHash, role, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $email, $passwordHash, $role, $ts, $ts, 0)`,
      {
        $id:           _id,
        $name:         v(data.name),
        $email:        v(data.email),
        $passwordHash: hashPassword(data.password),
        $role:         v(data.role ?? 'cashier'),
        $ts:           ts,
      }
    );

    return {
      success: true,
      data: { id: _id, name: data.name, role: data.role ?? 'cashier' },
    };
  });

  // ── GET ALL USERS ─────────────────────────────────────────────────────────
  ipcMain.handle('auth:getUsers', () => {
    return dbAll('SELECT _id, name, email, role, createdAt FROM users ORDER BY name ASC');
  });

  // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
  ipcMain.handle('auth:changePassword', (_e, userId: string, oldPassword: string, newPassword: string) => {
    const user = dbGet('SELECT * FROM users WHERE _id = $id', { $id: userId }) as any;
    if (!user) return { success: false, message: 'User not found' };

    if (!verifyPassword(oldPassword, user.passwordHash as string)) {
      return { success: false, message: 'Current password is incorrect' };
    }

    dbRun(
      `UPDATE users SET passwordHash=$hash, updatedAt=$ts, isSync=0 WHERE _id=$id`,
      { $hash: hashPassword(newPassword), $ts: now(), $id: userId }
    );
    return { success: true };
  });
}

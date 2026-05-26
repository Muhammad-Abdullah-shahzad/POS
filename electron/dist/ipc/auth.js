"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultAdmin = seedDefaultAdmin;
exports.registerAuthHandlers = registerAuthHandlers;
const electron_1 = require("electron");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../db/database");
// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers  (pbkdf2 — no bcrypt, no native compilation)
// ─────────────────────────────────────────────────────────────────────────────
const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
function hashPassword(password) {
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash)
        return false;
    const attempt = crypto_1.default.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
    }
    catch {
        return false;
    }
}
/**
 * Standard JWT signed with HS256 to be compatible with the remote web server.
 * The remote server uses process.env.JWT_SECRET || 'your_jwt_secret_key'
 */
function base64url(str) {
    return (typeof str === 'string' ? Buffer.from(str) : str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
function generateToken(userId, role) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (30 * 24 * 60 * 60); // 30 days
    const payload = { id: userId, role, iat, exp };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    // Must match the server's secret for sync to work
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
    const signature = crypto_1.default.createHmac('sha256', secret)
        .update(unsignedToken)
        .digest();
    return `${unsignedToken}.${base64url(signature)}`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Seed default admin on first launch
// ─────────────────────────────────────────────────────────────────────────────
function seedDefaultAdmin() {
    const usersToSeed = [
        { name: 'Admin', email: 'admin@pos.com', password: 'admin123', role: 'admin' },
        { name: 'Manager', email: 'manager@pos.com', password: 'manager123', role: 'manager' },
        { name: 'Cashier', email: 'cashier@pos.com', password: 'cashier123', role: 'cashier' },
    ];
    for (const u of usersToSeed) {
        const existing = (0, database_1.dbGet)('SELECT _id FROM users WHERE email = $email', { $email: u.email });
        if (!existing) {
            const _id = (0, database_1.generateLocalId)();
            const ts = (0, database_1.now)();
            (0, database_1.dbRun)(`INSERT INTO users (_id, name, email, passwordHash, role, createdAt, updatedAt, isSync)
         VALUES ($id, $name, $email, $passwordHash, $role, $ts, $ts, 0)`, {
                $id: _id,
                $name: u.name,
                $email: u.email,
                $passwordHash: hashPassword(u.password),
                $role: u.role,
                $ts: ts,
            });
            console.log(`[Auth] Default user seeded  →  ${u.email} / ${u.password} (${u.role})`);
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers
// ─────────────────────────────────────────────────────────────────────────────
function registerAuthHandlers() {
    // ── LOGIN ─────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('auth:login', (_e, email, password) => {
        const user = (0, database_1.dbGet)('SELECT * FROM users WHERE email = $email', { $email: email });
        if (!user) {
            return { success: false, message: 'Invalid credentials' };
        }
        if (!verifyPassword(password, user.passwordHash)) {
            return { success: false, message: 'Invalid credentials' };
        }
        const token = generateToken(user._id, user.role);
        return {
            success: true,
            data: {
                token,
                user: { id: user._id, name: user.name, role: user.role },
            },
        };
    });
    // ── REGISTER ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('auth:register', (_e, data) => {
        const existing = (0, database_1.dbGet)('SELECT _id FROM users WHERE email = $email', { $email: data.email });
        if (existing) {
            return { success: false, message: 'User already exists' };
        }
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO users (_id, name, email, passwordHash, role, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $email, $passwordHash, $role, $ts, $ts, 0)`, {
            $id: _id,
            $name: (0, database_1.v)(data.name),
            $email: (0, database_1.v)(data.email),
            $passwordHash: hashPassword(data.password),
            $role: (0, database_1.v)(data.role ?? 'cashier'),
            $ts: ts,
        });
        return {
            success: true,
            data: { id: _id, name: data.name, role: data.role ?? 'cashier' },
        };
    });
    // ── GET ALL USERS ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('auth:getUsers', () => {
        return (0, database_1.dbAll)('SELECT _id, name, email, role, createdAt FROM users ORDER BY name ASC');
    });
    // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
    electron_1.ipcMain.handle('auth:changePassword', (_e, userId, oldPassword, newPassword) => {
        const user = (0, database_1.dbGet)('SELECT * FROM users WHERE _id = $id', { $id: userId });
        if (!user)
            return { success: false, message: 'User not found' };
        if (!verifyPassword(oldPassword, user.passwordHash)) {
            return { success: false, message: 'Current password is incorrect' };
        }
        (0, database_1.dbRun)(`UPDATE users SET passwordHash=$hash, updatedAt=$ts, isSync=0 WHERE _id=$id`, { $hash: hashPassword(newPassword), $ts: (0, database_1.now)(), $id: userId });
        return { success: true };
    });
}
//# sourceMappingURL=auth.js.map
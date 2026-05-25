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
export declare function seedDefaultAdmin(): void;
export declare function registerAuthHandlers(): void;

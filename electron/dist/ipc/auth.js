"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthHandlers = registerAuthHandlers;
/**
 * Sign up and sign in on the till.
 *
 * The server is the authority on who may sign in and which company they belong
 * to, so the till always tries it first. When the shop has no connection it
 * falls back to the credentials cached from the last successful sign in, which
 * keeps the till usable through an outage without letting it invent access it
 * was never granted.
 *
 * The till never mints its own API tokens. Every token it holds was issued by
 * the server, which is what stops a desktop build from claiming another
 * company's data. The licence that arrives with each sign in is cached so the
 * till can keep checking it offline.
 */
const electron_1 = require("electron");
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const serverClient_1 = require("../api/serverClient");
const database_1 = require("../db/database");
const session_1 = require("../auth/session");
const licenseStore_1 = require("../license/licenseStore");
const failure = (message) => ({ success: false, message });
/** Keep a local copy of the account so the till can sign in without a connection. */
function cacheUser(user, password) {
    const timestamp = (0, database_1.now)();
    const existing = (0, database_1.dbGet)('SELECT localId FROM users WHERE email = $email', { $email: user.email });
    if (existing) {
        (0, database_1.dbRun)(`UPDATE users
          SET _id = $id, name = $name, role = $role, tenantId = $tenantId,
              passwordHash = $hash, updatedAt = $ts, isSync = 1
        WHERE email = $email`, {
            $id: user.id,
            $name: (0, database_1.v)(user.name),
            $role: (0, database_1.v)(user.role),
            $tenantId: user.tenantId,
            $hash: (0, session_1.hashPassword)(password),
            $ts: timestamp,
            $email: user.email,
        });
        return;
    }
    (0, database_1.dbRun)(`INSERT INTO users (_id, name, email, passwordHash, role, tenantId, createdAt, updatedAt, isSync)
     VALUES ($id, $name, $email, $hash, $role, $tenantId, $ts, $ts, 1)`, {
        $id: user.id || (0, database_1.generateLocalId)(),
        $name: (0, database_1.v)(user.name),
        $email: user.email,
        $hash: (0, session_1.hashPassword)(password),
        $role: (0, database_1.v)(user.role),
        $tenantId: user.tenantId,
        $ts: timestamp,
    });
}
/**
 * Everything that happens once the server has accepted a sign in or a sign up:
 * claim the till for the company, cache the account for offline use, keep the
 * tokens and the licence.
 */
function completeServerSignIn(session, password) {
    const { user, accessToken, refreshToken, license } = session;
    const storedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
    };
    // A till serves one shop. Signing a second company in would mix their
    // offline records together, so it is refused with an explicit way out.
    if (!(0, session_1.claimDevice)(storedUser.tenantId, storedUser.tenantName)) {
        const device = (0, session_1.getDeviceInfo)();
        return failure(`This till is registered to ${device.tenantName}. Reset the device before signing in with a different company.`);
    }
    cacheUser(storedUser, password);
    (0, session_1.saveSession)({ user: storedUser, accessToken, refreshToken });
    (0, licenseStore_1.storeLicenseFromServer)(license);
    return {
        success: true,
        data: { user: storedUser, accessToken, refreshToken, offline: false, license: (0, licenseStore_1.getLicenseStatus)() },
    };
}
async function signInWithServer(email, password) {
    const response = await axios_1.default.post(`${config_1.config.apiBaseUrl}/auth/login`, { email, password }, { timeout: 15000 });
    return completeServerSignIn(response.data.data, password);
}
async function registerWithServer(input) {
    const response = await axios_1.default.post(`${config_1.config.apiBaseUrl}/auth/register`, input, { timeout: 20000 });
    return completeServerSignIn(response.data.data, input.password);
}
function signInOffline(email, password) {
    const row = (0, database_1.dbGet)('SELECT * FROM users WHERE email = $email', { $email: email });
    if (!row || !(0, session_1.verifyPassword)(password, String(row.passwordHash))) {
        return failure('Cannot reach the server, and these details do not match this till.');
    }
    const device = (0, session_1.getDeviceInfo)();
    if (device.tenantId && row.tenantId && row.tenantId !== device.tenantId) {
        return failure(`This till is registered to ${device.tenantName}.`);
    }
    const session = (0, session_1.getSession)();
    const user = {
        id: String(row._id),
        name: String(row.name),
        email: String(row.email),
        role: String(row.role),
        tenantId: String(row.tenantId ?? device.tenantId ?? ''),
        tenantName: device.tenantName ?? 'Offline',
    };
    // The cached tokens may already have expired; sync refreshes them once the
    // connection is back. Until then the till runs entirely on local data, and
    // the cached licence decides whether it may run at all.
    return {
        success: true,
        data: {
            user,
            accessToken: session?.accessToken ?? '',
            refreshToken: session?.refreshToken ?? '',
            offline: true,
            license: (0, licenseStore_1.getLicenseStatus)(),
        },
    };
}
const serverMessage = (error, fallback) => error?.response?.data?.message ?? fallback;
function registerAuthHandlers() {
    electron_1.ipcMain.handle('auth:login', async (_event, email, password) => {
        const normalisedEmail = String(email ?? '').trim().toLowerCase();
        if (!normalisedEmail || !password)
            return failure('Enter your email and password');
        try {
            return await signInWithServer(normalisedEmail, password);
        }
        catch (error) {
            if ((0, serverClient_1.isNetworkFailure)(error)) {
                console.warn('[Auth] Server unreachable, falling back to the cached sign in');
                return signInOffline(normalisedEmail, password);
            }
            return failure(serverMessage(error, 'Sign in failed'));
        }
    });
    /** Create a new company from the till. Needs a connection, by nature. */
    electron_1.ipcMain.handle('auth:register', async (_event, input) => {
        const email = String(input?.email ?? '').trim().toLowerCase();
        if (!email || !input?.password || !input?.companyName || !input?.name) {
            return failure('Fill in the company name, your name, email and password');
        }
        try {
            return await registerWithServer({ ...input, email });
        }
        catch (error) {
            if ((0, serverClient_1.isNetworkFailure)(error)) {
                return failure('Creating an account needs an internet connection');
            }
            return failure(serverMessage(error, 'Sign up failed'));
        }
    });
    electron_1.ipcMain.handle('auth:logout', () => {
        (0, session_1.clearSession)();
        return { success: true };
    });
    /** Staff accounts on this till, for pickers and reports. */
    electron_1.ipcMain.handle('auth:getUsers', () => (0, database_1.dbAll)('SELECT _id, name, email, role, createdAt FROM users ORDER BY name ASC'));
    electron_1.ipcMain.handle('auth:getDevice', () => (0, session_1.getDeviceInfo)());
    /**
     * Hand the till over to a different company.
     *
     * Everything local belongs to the current company, so it is removed rather
     * than left behind for the next one to inherit. The licence lives in
     * app_meta and goes with it.
     */
    electron_1.ipcMain.handle('auth:resetDevice', () => {
        const tables = [
            'products', 'categories', 'orders', 'customers', 'employees',
            'expenses', 'expense_categories', 'employee_damages', 'suppliers',
            'bank_names', 'bank_accounts', 'bank_cards', 'settings', 'users',
            'pending_deletes',
        ];
        for (const table of tables) {
            (0, database_1.dbRun)(`DELETE FROM ${table}`);
        }
        (0, database_1.dbRun)('DELETE FROM app_meta');
        (0, session_1.clearSession)();
        return { success: true };
    });
    /**
     * Password changes go to the server, because that is where the credential
     * actually lives. The local copy is refreshed so offline sign in keeps
     * working with the new password.
     */
    electron_1.ipcMain.handle('auth:changePassword', async (_event, _userId, currentPassword, newPassword) => {
        const session = (0, session_1.getSession)();
        if (!session)
            return { success: false, message: 'Sign in again before changing your password' };
        try {
            await axios_1.default.post(`${config_1.config.apiBaseUrl}/auth/change-password`, { currentPassword, newPassword }, { headers: { Authorization: `Bearer ${session.accessToken}` }, timeout: 15000 });
            cacheUser(session.user, newPassword);
            (0, session_1.clearSession)();
            return { success: true, message: 'Password changed. Please sign in again.' };
        }
        catch (error) {
            if ((0, serverClient_1.isNetworkFailure)(error)) {
                return { success: false, message: 'A password change needs an internet connection' };
            }
            return { success: false, message: serverMessage(error, 'Could not change the password') };
        }
    });
}
//# sourceMappingURL=auth.js.map
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
import { ipcMain } from 'electron';
import axios from 'axios';
import { config } from '../config';
import { isNetworkFailure } from '../api/serverClient';
import { dbAll, dbGet, dbRun, generateLocalId, now, v } from '../db/database';
import {
  StoredUser,
  claimDevice,
  clearSession,
  getDeviceInfo,
  getSession,
  hashPassword,
  saveSession,
  verifyPassword,
} from '../auth/session';
import { DesktopLicenseStatus, getLicenseStatus, storeLicenseFromServer } from '../license/licenseStore';

interface LoginSuccess {
  success: true;
  data: {
    user: StoredUser;
    accessToken: string;
    refreshToken: string;
    /** True when the till authenticated against its local cache. */
    offline: boolean;
    license: DesktopLicenseStatus;
  };
}

interface LoginFailure {
  success: false;
  message: string;
}

type LoginResult = LoginSuccess | LoginFailure;

export interface RegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

/** The session payload every server sign in style endpoint returns. */
interface ServerSession {
  user: StoredUser;
  accessToken: string;
  refreshToken: string;
  license?: { key?: string | null } | null;
}

const failure = (message: string): LoginFailure => ({ success: false, message });

/** Keep a local copy of the account so the till can sign in without a connection. */
function cacheUser(user: StoredUser, password: string): void {
  const timestamp = now();
  const existing = dbGet('SELECT localId FROM users WHERE email = $email', { $email: user.email });

  if (existing) {
    dbRun(
      `UPDATE users
          SET _id = $id, name = $name, role = $role, tenantId = $tenantId,
              passwordHash = $hash, updatedAt = $ts, isSync = 1
        WHERE email = $email`,
      {
        $id: user.id,
        $name: v(user.name),
        $role: v(user.role),
        $tenantId: user.tenantId,
        $hash: hashPassword(password),
        $ts: timestamp,
        $email: user.email,
      }
    );
    return;
  }

  dbRun(
    `INSERT INTO users (_id, name, email, passwordHash, role, tenantId, createdAt, updatedAt, isSync)
     VALUES ($id, $name, $email, $hash, $role, $tenantId, $ts, $ts, 1)`,
    {
      $id: user.id || generateLocalId(),
      $name: v(user.name),
      $email: user.email,
      $hash: hashPassword(password),
      $role: v(user.role),
      $tenantId: user.tenantId,
      $ts: timestamp,
    }
  );
}

/**
 * Everything that happens once the server has accepted a sign in or a sign up:
 * claim the till for the company, cache the account for offline use, keep the
 * tokens and the licence.
 */
function completeServerSignIn(session: ServerSession, password: string): LoginResult {
  const { user, accessToken, refreshToken, license } = session;

  const storedUser: StoredUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: user.tenantName,
  };

  // A till serves one shop. Signing a second company in would mix their
  // offline records together, so it is refused with an explicit way out.
  if (!claimDevice(storedUser.tenantId, storedUser.tenantName)) {
    const device = getDeviceInfo();
    return failure(
      `This till is registered to ${device.tenantName}. Reset the device before signing in with a different company.`
    );
  }

  cacheUser(storedUser, password);
  saveSession({ user: storedUser, accessToken, refreshToken });
  storeLicenseFromServer(license);

  return {
    success: true,
    data: { user: storedUser, accessToken, refreshToken, offline: false, license: getLicenseStatus() },
  };
}

async function signInWithServer(email: string, password: string): Promise<LoginResult> {
  const response = await axios.post(
    `${config.apiBaseUrl}/auth/login`,
    { email, password },
    { timeout: 15_000 }
  );

  return completeServerSignIn(response.data.data as ServerSession, password);
}

async function registerWithServer(input: RegisterInput): Promise<LoginResult> {
  const response = await axios.post(`${config.apiBaseUrl}/auth/register`, input, { timeout: 20_000 });

  return completeServerSignIn(response.data.data as ServerSession, input.password);
}

function signInOffline(email: string, password: string): LoginResult {
  const row = dbGet('SELECT * FROM users WHERE email = $email', { $email: email }) as any;

  if (!row || !verifyPassword(password, String(row.passwordHash))) {
    return failure('Cannot reach the server, and these details do not match this till.');
  }

  const device = getDeviceInfo();
  if (device.tenantId && row.tenantId && row.tenantId !== device.tenantId) {
    return failure(`This till is registered to ${device.tenantName}.`);
  }

  const session = getSession();

  const user: StoredUser = {
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
      license: getLicenseStatus(),
    },
  };
}

const serverMessage = (error: any, fallback: string): string => error?.response?.data?.message ?? fallback;

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, email: string, password: string): Promise<LoginResult> => {
    const normalisedEmail = String(email ?? '').trim().toLowerCase();

    if (!normalisedEmail || !password) return failure('Enter your email and password');

    try {
      return await signInWithServer(normalisedEmail, password);
    } catch (error: any) {
      if (isNetworkFailure(error)) {
        console.warn('[Auth] Server unreachable, falling back to the cached sign in');
        return signInOffline(normalisedEmail, password);
      }

      return failure(serverMessage(error, 'Sign in failed'));
    }
  });

  /** Create a new company from the till. Needs a connection, by nature. */
  ipcMain.handle('auth:register', async (_event, input: RegisterInput): Promise<LoginResult> => {
    const email = String(input?.email ?? '').trim().toLowerCase();
    if (!email || !input?.password || !input?.companyName || !input?.name) {
      return failure('Fill in the company name, your name, email and password');
    }

    try {
      return await registerWithServer({ ...input, email });
    } catch (error: any) {
      if (isNetworkFailure(error)) {
        return failure('Creating an account needs an internet connection');
      }

      return failure(serverMessage(error, 'Sign up failed'));
    }
  });

  ipcMain.handle('auth:logout', () => {
    clearSession();
    return { success: true };
  });

  /** Staff accounts on this till, for pickers and reports. */
  ipcMain.handle('auth:getUsers', () =>
    dbAll('SELECT _id, name, email, role, createdAt FROM users ORDER BY name ASC')
  );

  ipcMain.handle('auth:getDevice', () => getDeviceInfo());

  /**
   * Hand the till over to a different company.
   *
   * Everything local belongs to the current company, so it is removed rather
   * than left behind for the next one to inherit. The licence lives in
   * app_meta and goes with it.
   */
  ipcMain.handle('auth:resetDevice', () => {
    const tables = [
      'products', 'categories', 'orders', 'customers', 'employees',
      'expenses', 'expense_categories', 'employee_damages', 'suppliers',
      'bank_names', 'bank_accounts', 'bank_cards', 'settings', 'users',
      'pending_deletes',
    ];

    for (const table of tables) {
      dbRun(`DELETE FROM ${table}`);
    }

    dbRun('DELETE FROM app_meta');
    clearSession();

    return { success: true };
  });

  /**
   * Password changes go to the server, because that is where the credential
   * actually lives. The local copy is refreshed so offline sign in keeps
   * working with the new password.
   */
  ipcMain.handle(
    'auth:changePassword',
    async (_event, _userId: string, currentPassword: string, newPassword: string) => {
      const session = getSession();
      if (!session) return { success: false, message: 'Sign in again before changing your password' };

      try {
        await axios.post(
          `${config.apiBaseUrl}/auth/change-password`,
          { currentPassword, newPassword },
          { headers: { Authorization: `Bearer ${session.accessToken}` }, timeout: 15_000 }
        );

        cacheUser(session.user, newPassword);
        clearSession();

        return { success: true, message: 'Password changed. Please sign in again.' };
      } catch (error: any) {
        if (isNetworkFailure(error)) {
          return { success: false, message: 'A password change needs an internet connection' };
        }
        return { success: false, message: serverMessage(error, 'Could not change the password') };
      }
    }
  );
}

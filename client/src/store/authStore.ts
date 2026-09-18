/**
 * Signed in session state.
 *
 * Holds the staff member, the company they belong to and the two tokens the
 * API issues. Persisted to localStorage so a refresh does not sign the till
 * out, and exposed through plain getters so the axios layer can read the
 * current tokens without subscribing to React state.
 */
import { create } from 'zustand';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** The company this login belongs to. All data the app sees is theirs. */
  tenantId: string;
  tenantName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  signIn: (user: AuthUser, tokens: AuthTokens) => void;
  /** Replace the tokens after a refresh, keeping the signed in user. */
  setTokens: (tokens: AuthTokens) => void;
  signOut: () => void;
  isAdmin: () => boolean;
}

const STORAGE_KEY = 'pos.session';

interface PersistedSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

function readSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedSession;
    // A session stored by an older build will not have a company on it.
    if (!parsed?.user?.tenantId || !parsed.accessToken) return null;

    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: PersistedSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // A full or blocked storage must not stop the till from working.
  }
}

const stored = readSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: stored?.user ?? null,
  accessToken: stored?.accessToken ?? null,
  refreshToken: stored?.refreshToken ?? null,

  signIn: (user, tokens) => {
    writeSession({ user, ...tokens });
    set({ user, ...tokens });
  },

  setTokens: (tokens) => {
    const { user } = get();
    if (user) writeSession({ user, ...tokens });
    set(tokens);
  },

  signOut: () => {
    writeSession(null);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  isAdmin: () => {
    const role = get().user?.role;
    return role === 'admin' || role === 'manager';
  },
}));

// Read-only accessors for code outside React, such as axios interceptors.
export const getAccessToken = (): string | null => useAuthStore.getState().accessToken;
export const getRefreshToken = (): string | null => useAuthStore.getState().refreshToken;

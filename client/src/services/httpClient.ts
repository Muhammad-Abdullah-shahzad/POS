/**
 * The HTTP client that talks to the POS API.
 *
 * Access tokens are short lived, so a 401 is expected during a shift rather
 * than exceptional. When one arrives the client refreshes once, replays the
 * failed request and carries on. Requests that arrive while a refresh is in
 * flight wait for it instead of each starting their own.
 *
 * A 402 means the company's licence is not in force. It is not retried: the
 * licence store is locked and the route guard shows the renewal screen.
 */
import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { licenseStatusFromServer, lockLicense, useLicenseStore } from '../store/licenseStore';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/** Endpoints that must never trigger a refresh, or the client would loop. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

interface RetriableRequest extends InternalAxiosRequestConfig {
  /** Set once a request has already been replayed after a refresh. */
  hasRetried?: boolean;
}

export const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

httpClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** In-flight refresh, shared by every request that hits a 401 at the same time. */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new Error('No refresh token');

  // A bare axios call, so this request does not pass back through the
  // interceptor that is currently handling a 401.
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });

  const { accessToken, refreshToken: rotated, user, license } = data.data;
  useAuthStore.getState().signIn(user, { accessToken, refreshToken: rotated });
  // Every session refresh carries the current licence, so a renewal or an
  // expiry is noticed without waiting for the next status check.
  if (license) useLicenseStore.getState().setStatus(licenseStatusFromServer(license));

  return accessToken;
}

function endSession(): void {
  useLicenseStore.getState().reset();
  useAuthStore.getState().signOut();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 402) {
      const body = error.response.data as
        | { code?: string; message?: string; details?: { expiresAt?: string } }
        | undefined;

      lockLicense(
        body?.code === 'LICENSE_MISSING' ? 'missing' : 'expired',
        body?.message ?? 'The licence for this company is not active.',
        body?.details?.expiresAt ?? null
      );
      return Promise.reject(error);
    }

    const request = error.config as RetriableRequest | undefined;
    const isAuthCall = AUTH_ENDPOINTS.some((path) => request?.url?.includes(path));

    if (error.response?.status !== 401 || !request || request.hasRetried || isAuthCall) {
      return Promise.reject(error);
    }

    try {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });

      const accessToken = await refreshInFlight;

      request.hasRetried = true;
      request.headers.Authorization = `Bearer ${accessToken}`;
      return await httpClient(request);
    } catch {
      // The refresh token is gone, expired or was already used elsewhere.
      endSession();
      return Promise.reject(error);
    }
  }
);

export default httpClient;

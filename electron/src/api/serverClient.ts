/**
 * An HTTP client for the POS API, signed in as this till.
 *
 * The access token is short lived by design. Rather than asking the cashier to
 * sign in again mid-shift, an expired token is refreshed with the stored
 * refresh token and the failed request is replayed once. Shared by sync and
 * licence refresh so the token handling lives in exactly one place.
 */
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { getSession, updateTokens } from '../auth/session';

async function refreshAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session?.refreshToken) return null;

  try {
    const response = await axios.post(
      `${config.apiBaseUrl}/auth/refresh`,
      { refreshToken: session.refreshToken },
      { timeout: 15_000 }
    );

    const { accessToken, refreshToken } = response.data.data;
    updateTokens(accessToken, refreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

/** Null when the till has never signed in against the server. */
export function createServerClient(): AxiosInstance | null {
  const session = getSession();
  if (!session?.accessToken && !session?.refreshToken) return null;

  const client = axios.create({
    baseURL: config.apiBaseUrl,
    headers: { Authorization: `Bearer ${session.accessToken}` },
    timeout: 30_000,
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const request = error.config as (typeof error.config & { hasRetried?: boolean }) | undefined;

      if (error.response?.status !== 401 || !request || request.hasRetried) {
        return Promise.reject(error);
      }

      const accessToken = await refreshAccessToken();
      if (!accessToken) return Promise.reject(error);

      request.hasRetried = true;
      request.headers.Authorization = `Bearer ${accessToken}`;
      client.defaults.headers.Authorization = `Bearer ${accessToken}`;

      return client(request);
    }
  );

  return client;
}

/** True when the request never reached the server, as opposed to being refused. */
export const isNetworkFailure = (error: unknown): boolean => !(error as { response?: unknown })?.response;

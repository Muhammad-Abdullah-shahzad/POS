/**
 * Staff logins on the desktop till.
 *
 * Staff accounts live on the server: they are what everyone signs in with,
 * on every till and on the web. So the till does not keep its own list; each
 * request goes to the server through the till's signed-in connection, and
 * the server applies its rules (admins only, unique emails, password policy).
 */
import { ipcMain } from 'electron';
import type { AxiosInstance } from 'axios';
import { createServerClient, isNetworkFailure } from '../api/serverClient';

/** The server's reason for a failure, or a plain one when it could not be reached. */
function failure(error: unknown): Error {
  if (isNetworkFailure(error)) {
    return new Error('Staff logins are managed on the server. Connect this till to the internet and try again.');
  }
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return new Error(message || 'The server could not complete this request');
}

/** Run a request as this till, turning any failure into a message the screen can show. */
async function asTill<T>(request: (client: AxiosInstance) => Promise<{ data: T }>): Promise<T> {
  const client = createServerClient();
  if (!client) throw new Error('This till is not signed in to the server. Sign in once while online, then try again.');
  try {
    return (await request(client)).data;
  } catch (error) {
    throw failure(error);
  }
}

export function registerStaffUserHandlers(): void {
  // Not licence-gated like data handlers: staff management is how an admin
  // regains access, and the server enforces who may do it.
  ipcMain.handle('users:list', () => asTill((client) => client.get('/users')));
  ipcMain.handle('users:create', (_e, data: Record<string, unknown>) => asTill((client) => client.post('/users', data)));
  ipcMain.handle('users:update', (_e, id: string, data: Record<string, unknown>) => asTill((client) => client.patch(`/users/${encodeURIComponent(id)}`, data)));
  ipcMain.handle('users:remove', (_e, id: string) => asTill((client) => client.delete(`/users/${encodeURIComponent(id)}`)));
}

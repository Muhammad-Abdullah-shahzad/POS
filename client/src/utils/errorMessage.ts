/**
 * The reason a request failed, fit to show the user: the server's message, or
 * the desktop app's error without the IPC channel prefix it adds.
 */
export function errorMessage(error: unknown, fallback: string): string {
  const failure = error as { response?: { data?: { message?: string } }; message?: string } | undefined;
  const fromServer = failure?.response?.data?.message;
  if (fromServer) return fromServer;

  const raw = failure?.message?.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  return raw || fallback;
}

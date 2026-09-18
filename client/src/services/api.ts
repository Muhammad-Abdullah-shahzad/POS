/**
 * The single data access point for the app.
 *
 * In the browser this is the HTTP client. Inside the desktop shell it is the
 * local SQLite bridge, which mirrors the same response envelope so feature code
 * does not care which one it is talking to.
 *
 * The choice is made per call rather than at module load, because the Electron
 * preload script may not have injected `window.electronAPI` yet when this
 * module is first imported.
 */
import httpClient from './httpClient';
import localApi from './localApi';

const api = new Proxy({} as typeof httpClient, {
  get(_target, property: string) {
    const implementation = window.electronAPI ? localApi : httpClient;
    return (implementation as never as Record<string, unknown>)[property];
  },
});

export default api;

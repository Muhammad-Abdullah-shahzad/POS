/**
 * Global type augmentation so the renderer (React/TypeScript) knows about
 * window.electronAPI without importing from the main process.
 *
 * Copy this file into client/src/types/ as well so the React app gets types.
 */

import type { ElectronAPI } from '../preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

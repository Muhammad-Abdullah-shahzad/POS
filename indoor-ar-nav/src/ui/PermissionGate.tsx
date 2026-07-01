import type { ArBackendKind } from '../types';
import { isCameraSupported } from '../ar/createArBackend';

interface PermissionGateProps {
  /** User chose how to start the experience. */
  onChoose: (kind: ArBackendKind) => void;
}

/**
 * Start screen. The camera/AR session must begin from a user gesture (mobile
 * requirement), so we ask here. Always offers a graceful demo-mode fallback,
 * and disables the camera path when the device clearly has no camera support.
 */
export function PermissionGate({ onChoose }: PermissionGateProps) {
  const cameraSupported = isCameraSupported();

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold text-white">Indoor AR Navigation</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Scan the printed marker to set “you are here”, pick a destination, and follow live 3D
          arrows on the floor to get there.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => onChoose('mindar')}
          disabled={!cameraSupported}
          className="rounded-xl bg-guide px-5 py-3 font-semibold text-slate-950 shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enable camera &amp; scan marker
        </button>
        <button
          type="button"
          onClick={() => onChoose('mock')}
          className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition active:scale-95"
        >
          Try demo mode (no camera)
        </button>
      </div>

      {!cameraSupported && (
        <p className="max-w-xs text-xs text-amber-400">
          No camera API detected on this device — demo mode still shows the full navigation flow.
        </p>
      )}
    </div>
  );
}

import { forwardRef } from 'react';

/**
 * Full-screen host element for the AR backend's camera feed + Three canvas.
 * It owns no logic — the backend injects the <video>/<canvas> into this div.
 */
export const CameraView = forwardRef<HTMLDivElement>((_props, ref) => {
  return (
    <div
      ref={ref}
      className="ar-container absolute inset-0 overflow-hidden bg-slate-950"
      aria-label="Camera view"
    />
  );
});

CameraView.displayName = 'CameraView';

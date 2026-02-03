// src/main.tsx
// Standard entrypunkt for Vite + React
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { setupPwaLaunchQueueConsumer } from './utils/pwaLaunchQueue';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import App from './App';

const UNSUPPORTED_MAX_WIDTH_PX = 1024;

const isTouchLikeDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0;
  if (typeof window.matchMedia !== 'function') {
    return touchPoints > 0;
  }
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  return touchPoints > 0 && (coarsePointer || noHover);
};

const isUnsupportedDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isTouchLikeDevice()) return true;
  if (typeof window.matchMedia !== 'function') {
    return window.innerWidth <= UNSUPPORTED_MAX_WIDTH_PX;
  }
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

const root = ReactDOM.createRoot(rootElement);

const registerServiceWorker = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Silent by design: SW is only used for installability; failures must not break the app.
  }
};

const bootstrap = async (): Promise<void> => {
  // PWA file handler (Launch Queue) skal initialiseres tidligt, ogs hvis vi ender p unsupported-device gate.
  setupPwaLaunchQueueConsumer();
  setupPwaInstallPromptCapture();

  if (isUnsupportedDevice()) {
    const { default: UnsupportedDevicePage } = await import('./components/pages/UnsupportedDevicePage');
    root.render(
      <React.StrictMode>
        <UnsupportedDevicePage />
      </React.StrictMode>
    );
    return;
  }

  await registerServiceWorker();

  if (isUnsupportedDevice()) {
    window.location.reload();
    return;
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();

// src/main.tsx
// Standard entrypunkt for Vite + React
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { setupPwaLaunchQueueConsumer } from './utils/pwaLaunchQueue';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';

const UNSUPPORTED_MAX_WIDTH_PX = 1024;
const UNSUPPORTED_VIEWPORT_QUERY = `(max-width: ${UNSUPPORTED_MAX_WIDTH_PX}px)`;

const isUnsupportedViewport = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(UNSUPPORTED_VIEWPORT_QUERY).matches;
  }
  return window.innerWidth <= UNSUPPORTED_MAX_WIDTH_PX;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

const root = ReactDOM.createRoot(rootElement);

const installViewportGate = (): void => {
  if (typeof window === 'undefined') return;
  if (typeof window.matchMedia !== 'function') return;

  const mediaQueryList = window.matchMedia(UNSUPPORTED_VIEWPORT_QUERY);
  if (mediaQueryList.matches) {
    return;
  }

  const handleChange = (event: MediaQueryListEvent): void => {
    if (event.matches) {
      window.location.reload();
    }
  };

  mediaQueryList.addEventListener('change', handleChange);
};

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
  // PWA file handler (Launch Queue) skal initialiseres tidligt, også hvis vi ender på unsupported-device gate.
  setupPwaLaunchQueueConsumer();
  setupPwaInstallPromptCapture();

  if (isUnsupportedViewport()) {
    const { default: UnsupportedDevicePage } = await import('./components/pages/UnsupportedDevicePage');
    root.render(
      <React.StrictMode>
        <UnsupportedDevicePage />
      </React.StrictMode>
    );
    return;
  }

  // Hard-stop: hvis viewport senere bliver unsupported, reload og vis gate-siden.
  // (Bevidst valg: vi auto-åbner ikke app'en igen ved senere resize til supported.)
  installViewportGate();
  await registerServiceWorker();

  const { default: App } = await import('./App');
  if (isUnsupportedViewport()) {
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

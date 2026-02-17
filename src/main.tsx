// src/main.tsx
// Standard entrypunkt for Vite + React
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { setupPwaLaunchQueueConsumer } from './utils/pwaLaunchQueue';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import { VERSION } from './config/version';
import AuthGate from './components/AuthGate';

const UNSUPPORTED_MAX_WIDTH_PX = 1024;
const SW_UPDATE_CHECK_TIMEOUT_MS = 5000;
const SW_PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000;
const swUpdateLifecycleWired = new WeakSet<ServiceWorkerRegistration>();

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

  const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(VERSION)}`;
  let hasTriggeredReload = false;

  const reloadOnce = (): void => {
    if (hasTriggeredReload) return;
    hasTriggeredReload = true;
    window.location.reload();
  };

  const activateWaitingWorker = (registration: ServiceWorkerRegistration): void => {
    const waiting = registration.waiting;
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    reloadOnce();
  };

  const wireUpdateLifecycle = (registration: ServiceWorkerRegistration): void => {
    if (swUpdateLifecycleWired.has(registration)) return;
    swUpdateLifecycleWired.add(registration);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaitingWorker(registration);
        }
      });
    });
  };

  const waitForInstalledOrRedundant = async (worker: ServiceWorker): Promise<void> => {
    if (worker.state === 'installed' || worker.state === 'redundant') {
      return;
    }

    await new Promise<void>((resolve) => {
      const handleStateChange = (): void => {
        if (worker.state === 'installed' || worker.state === 'redundant') {
          worker.removeEventListener('statechange', handleStateChange);
          resolve();
        }
      };
      worker.addEventListener('statechange', handleStateChange);
    });
  };

  try {
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });

    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: '/',
      updateViaCache: 'none',
    });

    wireUpdateLifecycle(registration);
    await registration.update();

    activateWaitingWorker(registration);

    const installing = registration.installing;
    if (installing) {
      await waitForInstalledOrRedundant(installing);
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        activateWaitingWorker(registration);
      }
    }
  } catch (error) {
    // App continues safely without SW update orchestration.
    console.warn('Service worker registrering/opdatering fejlede.', error);
  }
};

const ensureLatestVersionBeforeRender = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  await Promise.race([
    registerServiceWorker(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, SW_UPDATE_CHECK_TIMEOUT_MS);
    }),
  ]);
};

const checkForServiceWorkerUpdate = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (navigator.onLine === false) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!swUpdateLifecycleWired.has(registration)) {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      swUpdateLifecycleWired.add(registration);
    }
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    await registration.update();
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    // Non-fatal: next trigger retries deterministically.
  }
};

const setupServiceWorkerUpdateChecks = (): void => {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.setInterval(() => {
    void checkForServiceWorkerUpdate();
  }, SW_PERIODIC_UPDATE_CHECK_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void checkForServiceWorkerUpdate();
  });

  window.addEventListener('online', () => {
    void checkForServiceWorkerUpdate();
  });
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

  await ensureLatestVersionBeforeRender();
  setupServiceWorkerUpdateChecks();

  if (isUnsupportedDevice()) {
    window.location.reload();
    return;
  }

  root.render(
    <React.StrictMode>
      <AuthGate />
    </React.StrictMode>
  );
};

void bootstrap();

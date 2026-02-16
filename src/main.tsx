// src/main.tsx
// Standard entrypunkt for Vite + React
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { setupPwaLaunchQueueConsumer } from './utils/pwaLaunchQueue';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import { VERSION } from './config/version';
import App from './App';
import LoginPage from './components/pages/LoginPage';
import { isAuthenticated } from './auth/auth';

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

const AuthGate = (): React.JSX.Element => {
  const [authenticated, setAuthenticated] = React.useState<boolean>(() => isAuthenticated());

  React.useEffect(() => {
    const handleStorage = (): void => {
      setAuthenticated(isAuthenticated());
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (authenticated) {
    return <App />;
  }

  return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
};

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

  try {
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });

    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: '/',
      updateViaCache: 'none',
    });

    await registration.update();

    const activateWaitingWorker = (): void => {
      const waiting = registration.waiting;
      if (!waiting) return;
      waiting.postMessage({ type: 'SKIP_WAITING' });
      reloadOnce();
    };

    activateWaitingWorker();

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaitingWorker();
        }
      });
    });
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
      <AuthGate />
    </React.StrictMode>
  );
};

void bootstrap();

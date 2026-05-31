import { VERSION } from '../../config/version';

const SW_UPDATE_CHECK_TIMEOUT_MS = 5000;
const SW_PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000;
const swUpdateLifecycleWired = new WeakSet<ServiceWorkerRegistration>();

const isPwaFileOpenRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/open';
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
    console.warn('Service worker registrering/opdatering fejlede.', error);
  }
};

export const ensureLatestServiceWorkerBeforeRender = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (isPwaFileOpenRoute()) return;

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
    // Ikke-fatal: næste trigger forsøger igen deterministisk.
  }
};

export const setupServiceWorkerUpdateChecks = (): void => {
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

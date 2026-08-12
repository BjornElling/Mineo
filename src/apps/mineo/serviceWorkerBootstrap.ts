import { VERSION } from '../../config/buildInfo';

const SW_UPDATE_CHECK_TIMEOUT_MS = 5000;
const SW_PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000;
const swUpdateLifecycleWired = new WeakSet<ServiceWorkerRegistration>();

export type ServiceWorkerUpdateStatus = 'idle' | 'ready' | 'activating';

let updateStatus: ServiceWorkerUpdateStatus = 'idle';
let updateRegistration: ServiceWorkerRegistration | null = null;
let reloadAfterAcceptedUpdate = false;
let hasTriggeredReload = false;
let controllerChangeWired = false;
const updateStatusListeners = new Set<() => void>();

const publishUpdateStatus = (nextStatus: ServiceWorkerUpdateStatus): void => {
  if (updateStatus === nextStatus) return;
  updateStatus = nextStatus;
  for (const listener of updateStatusListeners) listener();
};

export const getServiceWorkerUpdateStatus = (): ServiceWorkerUpdateStatus => updateStatus;

export const subscribeServiceWorkerUpdateStatus = (listener: () => void): (() => void) => {
  updateStatusListeners.add(listener);
  return () => {
    updateStatusListeners.delete(listener);
  };
};

const isPwaFileOpenRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/open';
};

/**
 * En ny worker må aldrig tage kontrol over en aktiv sag af sig selv. Brugeren vælger tidspunktet
 * i shellens opdateringslinje, som først afslutter en eventuel åben editor gennem inputkernen.
 */
const announceWaitingUpdate = (registration: ServiceWorkerRegistration): void => {
  if (!registration.waiting) return;
  if (!navigator.serviceWorker.controller) return;
  updateRegistration = registration;
  publishUpdateStatus('ready');
};

const clearWaitingUpdate = (): void => {
  updateRegistration = null;
  publishUpdateStatus('idle');
};

/** Første installation sker før app-render og kan derfor aktiveres uden at afbryde brugerarbejde. */
const activateFirstInstall = (registration: ServiceWorkerRegistration): void => {
  if (navigator.serviceWorker.controller !== null) return;
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
};

const reloadAfterAcceptedControllerChange = (): void => {
  if (!reloadAfterAcceptedUpdate || hasTriggeredReload) {
    clearWaitingUpdate();
    return;
  }
  hasTriggeredReload = true;
  window.location.reload();
};

const wireControllerChange = (): void => {
  if (controllerChangeWired) return;
  controllerChangeWired = true;
  navigator.serviceWorker.addEventListener('controllerchange', reloadAfterAcceptedControllerChange);
};

/**
 * Aktiverer en allerede annonceret opdatering. Kaldet er bevidst ikke en direkte reload: først når
 * den nye service worker har taget kontrol (`controllerchange`), genindlæses dokumentet.
 */
export const activateAvailableServiceWorkerUpdate = (): boolean => {
  if (!import.meta.env.PROD) return false;
  const waiting = updateRegistration?.waiting;
  if (!waiting || updateStatus !== 'ready') return false;

  reloadAfterAcceptedUpdate = true;
  publishUpdateStatus('activating');
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
};

// Én fælles update-lifecycle-wiring. Idempotent pr. registration via WeakSet.
// `navigator.serviceWorker.ready` og `register()` resolver til samme registration-objekt,
// så både boot-stien og de periodiske tjek deler denne ene wiring og dermed samme adfærd.
const wireUpdateLifecycle = (registration: ServiceWorkerRegistration): void => {
  if (swUpdateLifecycleWired.has(registration)) {
    if (navigator.serviceWorker.controller === null) {
      activateFirstInstall(registration);
    } else {
      announceWaitingUpdate(registration);
    }
    return;
  }
  swUpdateLifecycleWired.add(registration);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        if (navigator.serviceWorker.controller === null) {
          activateFirstInstall(registration);
        } else {
          announceWaitingUpdate(registration);
        }
      }
    });
  });
  if (navigator.serviceWorker.controller === null) {
    activateFirstInstall(registration);
  } else {
    announceWaitingUpdate(registration);
  }
};

const registerServiceWorker = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(VERSION)}`;

  try {
    wireControllerChange();
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: '/',
      updateViaCache: 'none',
    });

    wireUpdateLifecycle(registration);
    await registration.update();
    announceWaitingUpdate(registration);
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
    wireUpdateLifecycle(registration);
    await registration.update();
    announceWaitingUpdate(registration);
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

/** Kun testinfrastruktur må nulstille den modulglobale service-worker-livscyklus. */
export const __resetServiceWorkerBootstrapForTests = (): void => {
  updateStatus = 'idle';
  updateRegistration = null;
  reloadAfterAcceptedUpdate = false;
  hasTriggeredReload = false;
  controllerChangeWired = false;
  updateStatusListeners.clear();
};

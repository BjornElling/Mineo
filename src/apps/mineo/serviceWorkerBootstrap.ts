import { VERSION } from '../../config/buildInfo';

const SW_UPDATE_CHECK_TIMEOUT_MS = 5000;
const SW_PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000;
const swUpdateLifecycleWired = new WeakSet<ServiceWorkerRegistration>();

// Hvorvidt der allerede var en aktiv controller, da dokumentet loadede.
//
// Dette afgør, om en `controllerchange` skal udløse reload:
// - Første install (ingen controller endnu): `sw.js` kalder `clients.claim()` i sin
//   activate-handler, hvilket fyrer `controllerchange` på et dokument der lige er booted.
//   Det er IKKE en opdatering — at reloade dér ville give en uønsket hard-reload midt i
//   første åbning (og potentielt tabe ikke-gemt indtastning). Vi springer derfor reload over.
// - Senere aktivering af en *waiting* worker (controller fandtes ved load): det ER en
//   opdatering, og reload er den korrekte måde at tage den nye kode i brug på.
const hadControllerAtLoad = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  return navigator.serviceWorker.controller !== null;
};

const isPwaFileOpenRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/open';
};

let hasTriggeredReload = false;
let controllerExistedAtLoad = false;

const reloadForActivatedUpdate = (): void => {
  // Reload kun hvis dette er en reel opdatering (controller fandtes ved load), ikke
  // første-install-claim. Engangs-guard mod dobbelt-reload i samme dokument.
  if (!controllerExistedAtLoad) return;
  if (hasTriggeredReload) return;
  hasTriggeredReload = true;
  window.location.reload();
};

// Bed en ventende worker om at aktivere. Den faktiske reload sker via `controllerchange`
// (registreret ved boot), så aktivering og reload har én fælles gate (`reloadForActivatedUpdate`).
const promoteWaitingWorker = (registration: ServiceWorkerRegistration): void => {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
};

// Én fælles update-lifecycle-wiring. Idempotent pr. registration via WeakSet.
// `navigator.serviceWorker.ready` og `register()` resolver til samme registration-objekt,
// så både boot-stien og de periodiske tjek deler denne ene wiring og dermed samme adfærd.
const wireUpdateLifecycle = (registration: ServiceWorkerRegistration): void => {
  if (swUpdateLifecycleWired.has(registration)) return;
  swUpdateLifecycleWired.add(registration);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        promoteWaitingWorker(registration);
      }
    });
  });
};

const registerServiceWorker = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(VERSION)}`;

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
    navigator.serviceWorker.addEventListener('controllerchange', reloadForActivatedUpdate, { once: true });

    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: '/',
      updateViaCache: 'none',
    });

    wireUpdateLifecycle(registration);
    await registration.update();

    promoteWaitingWorker(registration);

    const installing = registration.installing;
    if (installing) {
      await waitForInstalledOrRedundant(installing);
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        promoteWaitingWorker(registration);
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

  // Snapshot controller-tilstanden FØR registrering: efter `register()`/`claim()` kan
  // controller være sat, og så ville reload-gaten ikke længere kunne skelne første install
  // fra en reel opdatering.
  controllerExistedAtLoad = hadControllerAtLoad();

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
    promoteWaitingWorker(registration);
    await registration.update();
    promoteWaitingWorker(registration);
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

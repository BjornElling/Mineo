import { isRunningInsideInstalledPwa } from './pwaDisplayMode';

export type PwaInstallOutcome = 'accepted' | 'dismissed';

export type PwaInstallUnavailableReason = 'promptUnavailable' | 'statusUnknown' | 'promptFailed';

export type PwaInstallResult =
  | { kind: 'unavailable'; reason: PwaInstallUnavailableReason }
  | { kind: 'alreadyInstalled'; state: Exclude<PwaInstallationState, 'notInstalled' | 'unknown'> }
  | { kind: 'completed'; outcome: PwaInstallOutcome };

/**
 * Hvor brugeren står, når hen beder om at hente hjælpeprogrammet.
 *
 * - `running`   — vi kører allerede INDE i det installerede hjælpeprogram. Der er intet at åbne.
 * - `installed` — vi står i browseren, men hjælpeprogrammet er installeret på maskinen.
 * - `notInstalled` — opslaget bekræfter, at der ikke findes en installation.
 * - `unknown` — browseren kan ikke give et sikkert svar.
 */
export type PwaInstallationState = 'running' | 'installed' | 'notInstalled' | 'unknown';

type InstallPromptSetupMode = 'capture' | 'suppress';

let setupMode: InstallPromptSetupMode | null = null;
let isInstalled = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;

const setupPwaInstallPrompt = (mode: InstallPromptSetupMode): void => {
  if (typeof window === 'undefined') return;
  if (setupMode !== null) return;
  setupMode = mode;

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    if (mode === 'suppress') {
      event.preventDefault();
      deferredPrompt = null;
      return;
    }

    // Prompten skal først vises ved klik på vores egen kontrol. Uden preventDefault kan browseren
    // åbne sin egen installationsflade før brugeren klikker, og det gemte event kan derefter ikke
    // bruges sikkert af vores kontrol.
    event.preventDefault();
    const promptEvent = event as BeforeInstallPromptEvent;
    deferredPrompt = promptEvent;
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
  });
};

export const setupPwaInstallPromptCapture = (): void => {
  setupPwaInstallPrompt('capture');
};

export const suppressPwaInstallPrompt = (): void => {
  setupPwaInstallPrompt('suppress');
};

/**
 * Skal svare til `start_url` i `public/manifest.json`; bundet af en test, så de ikke kan drifte fra
 * hinanden. Åbnes en anden sti, starter hjælpeprogrammet et andet sted end det selv ville.
 */
export const PWA_START_URL = '/';
export const PWA_MANIFEST_URL = '/manifest.json';

const getUrlPath = (value: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return new URL(value, window.location.href).pathname;
  } catch {
    // Browserens relation er ekstern input. En ugyldig URL må ikke afbryde klik-flowet og blive
    // misrapporteret som en fejlende installationsprompt.
    return null;
  }
};

const isMineoRelatedApplication = (app: RelatedApplication): boolean => {
  if (app.platform !== 'webapp') return false;
  if (typeof window === 'undefined') return false;

  const manifestPath = new URL(PWA_MANIFEST_URL, window.location.href).pathname;
  const appIdPath = new URL(PWA_START_URL, window.location.href).pathname;
  const urlMatches = app.url === undefined || getUrlPath(app.url) === manifestPath;
  const idMatches = app.id === undefined || getUrlPath(app.id) === appIdPath;

  // `getInstalledRelatedApps()` har allerede valideret relationen ud fra sidens manifest. Vi
  // sammenligner derfor paths, ikke origins: dev-server og deploy kan have forskellige origins,
  // mens Mineos manifest- og app-id-path er stabile. Begge felter skal passe, når browseren
  // leverer dem; et manglende felt er tilladt af browserens API.
  return urlMatches && idMatches;
};

/**
 * Afgør, om hjælpeprogrammet allerede er installeret — set fra der hvor brugeren står.
 *
 * Ingen af signalerne er alene tilstrækkelige, og de er bevidst ordnet efter faldende sikkerhed:
 *
 * 1. Kører vi i PWA-vinduet, ER den installeret; intet opslag kan modsige det.
 * 2. `appinstalled` i denne fane er ligeledes et positivt bevis (modulets `isInstalled`).
 * 3. `getInstalledRelatedApps()` er det eneste signal, der kan se en installation foretaget i en
 *    ANDEN fane eller session. Kun Chromium har den, og den kan kaste — et kast betyder «ved ikke»,
 *    ikke «ikke installeret».
 * 4. Har browseren tilbudt os en installprompt, er den beviseligt IKKE installeret. Fravær af både
 *    opslag og prompt er derimod ukendt — især Safari/Firefox kan hverken udspørges eller levere
 *    `beforeinstallprompt`, så det må ikke fejlagtigt kaldes `notInstalled`.
 */
export const detectPwaInstallationState = async (): Promise<PwaInstallationState> => {
  if (isRunningInsideInstalledPwa()) return 'running';
  if (isInstalled) return 'installed';
  if (deferredPrompt) return 'notInstalled';

  if (typeof navigator !== 'undefined' && typeof navigator.getInstalledRelatedApps === 'function') {
    try {
      const relatedApps = await navigator.getInstalledRelatedApps();
      if (!Array.isArray(relatedApps)) return 'unknown';
      const hasMineoPwa = relatedApps.some(isMineoRelatedApplication);
      return hasMineoPwa ? 'installed' : 'notInstalled';
    } catch {
      // Et opslag, der fejler, er ikke bevis for fravær af installation.
      return 'unknown';
    }
  }

  return 'unknown';
};

/**
 * Åbn (eller fokusér) det installerede hjælpeprogram.
 *
 * Manifestets `launch_handler.client_mode: 'focus-existing'` gør, at et allerede åbent PWA-vindue
 * fokuseres i stedet for at der åbnes en dublet. Vi peger på manifestets `start_url` — ikke den
 * aktuelle sti — så programmet starter dér, hvor det selv ville starte.
 */
export const openInstalledPwa = (): boolean => {
  if (typeof window === 'undefined') return false;
  const openedWindow = window.open(PWA_START_URL, '_blank');
  if (openedWindow === null) return false;

  // `noopener` som tredje argument gør browserens returværdi null — også når åbningen lykkes —
  // så den kan ikke bruges til at opdage popup-blokering. Vinduet er samme-origin; nulstilling af
  // opener-referencen efter åbningen bevarer sikkerhedsformålet uden at forveksle succes med fejl.
  openedWindow.opener = null;
  return true;
};

export const requestPwaInstall = async (): Promise<PwaInstallResult> => {
  if (isRunningInsideInstalledPwa()) return { kind: 'alreadyInstalled', state: 'running' };
  if (isInstalled) return { kind: 'alreadyInstalled', state: 'installed' };
  if (setupMode === 'suppress') {
    return { kind: 'unavailable', reason: 'promptUnavailable' };
  }

  // Denne funktion kaldes direkte fra klik-handleren. Så længe prompt-kaldet står før det første
  // `await`, bevarer browseren brugeraktiveringen, som `beforeinstallprompt.prompt()` kræver.
  const prompt = deferredPrompt;
  if (!prompt) {
    const state = await detectPwaInstallationState();
    if (state === 'running' || state === 'installed') {
      return { kind: 'alreadyInstalled', state };
    }
    return {
      kind: 'unavailable',
      reason: state === 'unknown' ? 'statusUnknown' : 'promptUnavailable',
    };
  }

  deferredPrompt = null;

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;

    if (choice.outcome === 'accepted') {
      isInstalled = true;
    }

    return { kind: 'completed', outcome: choice.outcome };
  } catch {
    return { kind: 'unavailable', reason: 'promptFailed' };
  }
};

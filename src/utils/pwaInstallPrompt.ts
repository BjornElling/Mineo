type PwaInstallOutcome = 'accepted' | 'dismissed';

type PwaInstallResult =
  | { kind: 'unavailable' }
  | { kind: 'alreadyInstalled' }
  | { kind: 'completed'; outcome: PwaInstallOutcome };

/**
 * Hvor brugeren står, når hen beder om at hente hjælpeprogrammet.
 *
 * - `running`   — vi kører allerede INDE i det installerede hjælpeprogram. Der er intet at åbne.
 * - `installed` — vi står i browseren, men hjælpeprogrammet er installeret på maskinen.
 * - `notInstalled` — intet spor af en installation; den almindelige installationsvej gælder.
 */
export type PwaInstallationState = 'running' | 'installed' | 'notInstalled';

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

    const promptEvent = event as BeforeInstallPromptEvent;
    // Vi kalder ikke preventDefault her: browserens standard adfærd bevares også i development.
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

const STANDALONE_DISPLAY_MODE_QUERY = '(display-mode: standalone)';

/**
 * Skal svare til `start_url` i `public/manifest.json`; bundet af en test, så de ikke kan drifte fra
 * hinanden. Åbnes en anden sti, starter hjælpeprogrammet et andet sted end det selv ville.
 */
export const PWA_START_URL = '/';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

/**
 * Kører dette dokument i det installerede hjælpeprograms eget vindue?
 *
 * Samme to signaler som `useInstalledPwaDisplayMode`: standalone-display-mode dækker Chromium og
 * desktop, `navigator.standalone` dækker iOS' hjemmeskærms-vindue, som ikke sætter display-mode.
 */
const isRunningInsideInstalledPwa = (): boolean => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(STANDALONE_DISPLAY_MODE_QUERY).matches) {
    return true;
  }
  return typeof navigator !== 'undefined' && (navigator as NavigatorWithStandalone).standalone === true;
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
 *    ikke «ikke installeret», så vi falder videre til punkt 4 frem for at melde noget forkert.
 * 4. Har browseren tilbudt os en installprompt, er den beviseligt IKKE installeret. Fraværet af en
 *    prompt beviser derimod intet (Safari/Firefox fyrer den aldrig), så det fald-tilbage-svar er
 *    `notInstalled`: den bevarer den almindelige installationsvej i browsere, vi ikke kan udspørge.
 */
export const detectPwaInstallationState = async (): Promise<PwaInstallationState> => {
  if (isRunningInsideInstalledPwa()) return 'running';
  if (isInstalled) return 'installed';

  if (typeof navigator !== 'undefined' && typeof navigator.getInstalledRelatedApps === 'function') {
    try {
      const relatedApps = await navigator.getInstalledRelatedApps();
      if (relatedApps.length > 0) return 'installed';
    } catch {
      // Ved ikke — lad de øvrige signaler afgøre det.
    }
  }

  return 'notInstalled';
};

/**
 * Åbn (eller fokusér) det installerede hjælpeprogram.
 *
 * Manifestets `launch_handler.client_mode: 'focus-existing'` gør, at et allerede åbent PWA-vindue
 * fokuseres i stedet for at der åbnes en dublet. Vi peger på manifestets `start_url` — ikke den
 * aktuelle sti — så programmet starter dér, hvor det selv ville starte.
 */
export const openInstalledPwa = (): void => {
  if (typeof window === 'undefined') return;
  window.open(PWA_START_URL, '_blank', 'noopener');
};

export const requestPwaInstall = async (): Promise<PwaInstallResult> => {
  if (isInstalled) return { kind: 'alreadyInstalled' };
  if (!deferredPrompt) return { kind: 'unavailable' };

  const prompt = deferredPrompt;
  deferredPrompt = null;

  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome === 'accepted') {
    isInstalled = true;
  }

  return { kind: 'completed', outcome: choice.outcome };
};


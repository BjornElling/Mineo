type PwaInstallOutcome = 'accepted' | 'dismissed';

type PwaInstallResult =
  | { kind: 'unavailable' }
  | { kind: 'alreadyInstalled' }
  | { kind: 'completed'; outcome: PwaInstallOutcome };

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


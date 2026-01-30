type PwaInstallOutcome = 'accepted' | 'dismissed';

type PwaInstallResult =
  | { kind: 'unavailable' }
  | { kind: 'alreadyInstalled' }
  | { kind: 'completed'; outcome: PwaInstallOutcome };

let isInitialized = false;
let isInstalled = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const setupPwaInstallPromptCapture = (): void => {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  isInitialized = true;

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
  });
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


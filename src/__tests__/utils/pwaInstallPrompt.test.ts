// @vitest-environment jsdom
import manifest from '../../../public/manifest.json';

/**
 * jsdom har hverken `matchMedia` eller `getInstalledRelatedApps`. Testene sætter derfor selv de
 * signaler, detektionen læser, og rydder op bagefter — ellers lækker en «installeret»-tilstand
 * videre til næste test og gør den grøn af den forkerte grund.
 */
const setStandaloneDisplayMode = (standalone: boolean): void => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)' ? standalone : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
};

const setInstalledRelatedApps = (
  result: RelatedApplication[] | Error
): void => {
  Object.defineProperty(navigator, 'getInstalledRelatedApps', {
    configurable: true,
    value: vi.fn().mockImplementation(() => (
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    )),
  });
};

describe('pwaInstallPrompt', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Reflect.deleteProperty(navigator, 'getInstalledRelatedApps');
    Reflect.deleteProperty(navigator, 'standalone');
  });

  it('capturer installprompt på understøttede enheder', async () => {
    const { requestPwaInstall, setupPwaInstallPromptCapture } = await import('../../utils/pwaInstallPrompt');
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;

    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    setupPwaInstallPromptCapture();
    window.dispatchEvent(event);

    const result = await requestPwaInstall();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(result).toEqual({ kind: 'completed', outcome: 'accepted' });
  });

  it('undertrykker installprompt på unsupported enheder', async () => {
    const { requestPwaInstall, suppressPwaInstallPrompt } = await import('../../utils/pwaInstallPrompt');
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    suppressPwaInstallPrompt();
    window.dispatchEvent(event);

    const result = await requestPwaInstall();

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'unavailable', reason: 'promptUnavailable' });
  });

  describe('detectPwaInstallationState', () => {
    it('melder «running» når vi kører i PWA-vinduets standalone-display-mode', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(true);
      // Kun display-mode må afgøre det her: opslaget svarer «ikke installeret», og det skal IKKE vinde.
      setInstalledRelatedApps([]);

      await expect(detectPwaInstallationState()).resolves.toBe('running');
    });

    it('melder «running» i iOS-hjemmeskærmens vindue, som ikke sætter display-mode', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });

      await expect(detectPwaInstallationState()).resolves.toBe('running');
    });

    it('melder «installed» i browseren når opslaget kender en installation', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setInstalledRelatedApps([{ platform: 'webapp', url: '/manifest.json' }]);

      await expect(detectPwaInstallationState()).resolves.toBe('installed');
    });

    it('melder «installed» efter appinstalled i denne fane — også uden opslag', async () => {
      const { detectPwaInstallationState, setupPwaInstallPromptCapture } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setupPwaInstallPromptCapture();

      // Installationen sker i en anden flade end vores link; modulet hører den via `appinstalled`.
      window.dispatchEvent(new Event('appinstalled'));

      await expect(detectPwaInstallationState()).resolves.toBe('installed');
    });

    it('melder «notInstalled» når opslaget ikke kender nogen installation', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setInstalledRelatedApps([]);

      await expect(detectPwaInstallationState()).resolves.toBe('notInstalled');
    });

    it('melder «unknown» når opslaget kaster — et fejlende opslag er ikke bevis for fravær', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setInstalledRelatedApps(new Error('NotAllowedError'));

      await expect(detectPwaInstallationState()).resolves.toBe('unknown');
    });

    it('melder «unknown» i browsere helt uden opslag (Safari/Firefox)', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);

      expect(navigator.getInstalledRelatedApps).toBeUndefined();
      await expect(detectPwaInstallationState()).resolves.toBe('unknown');
    });

    it('ignorerer relaterede apps, der ikke er Mineos webapp', async () => {
      const { detectPwaInstallationState } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setInstalledRelatedApps([
        { platform: 'play', url: 'https://play.google.com/store/apps/details?id=other.app' },
      ]);

      await expect(detectPwaInstallationState()).resolves.toBe('notInstalled');
    });
  });

  describe('requestPwaInstall', () => {
    it('finder en kendt installation uden installprompt', async () => {
      const { requestPwaInstall } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setInstalledRelatedApps([{ platform: 'webapp', url: '/manifest.json' }]);

      await expect(requestPwaInstall()).resolves.toEqual({
        kind: 'alreadyInstalled',
        state: 'installed',
      });
    });

    it('returnerer en tydelig unavailable-årsag, når installationen ikke kan startes', async () => {
      const { requestPwaInstall } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);
      setInstalledRelatedApps([]);

      await expect(requestPwaInstall()).resolves.toEqual({
        kind: 'unavailable',
        reason: 'promptUnavailable',
      });
    });

    it('returnerer statusUnknown, når browseren hverken kan måle eller vise prompten', async () => {
      const { requestPwaInstall } = await import('../../utils/pwaInstallPrompt');
      setStandaloneDisplayMode(false);

      await expect(requestPwaInstall()).resolves.toEqual({
        kind: 'unavailable',
        reason: 'statusUnknown',
      });
    });

    it('rapporterer promptFailed, hvis browserens prompt kaster', async () => {
      const { requestPwaInstall, setupPwaInstallPromptCapture } = await import('../../utils/pwaInstallPrompt');
      const prompt = vi.fn().mockRejectedValue(new Error('blocked'));
      const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;

      Object.assign(event, {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      });

      setupPwaInstallPromptCapture();
      window.dispatchEvent(event);

      await expect(requestPwaInstall()).resolves.toEqual({
        kind: 'unavailable',
        reason: 'promptFailed',
      });
    });
  });

  describe('openInstalledPwa', () => {
    it('åbner manifestets start_url, så programmet starter hvor det selv ville', async () => {
      const { openInstalledPwa, PWA_START_URL } = await import('../../utils/pwaInstallPrompt');
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

      openInstalledPwa();

      expect(openSpy).toHaveBeenCalledWith(PWA_START_URL, '_blank');
      openSpy.mockRestore();
    });

    it('returnerer false, hvis browseren blokerer det nye vindue', async () => {
      const { openInstalledPwa } = await import('../../utils/pwaInstallPrompt');
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

      expect(openInstalledPwa()).toBe(false);

      openSpy.mockRestore();
    });

    it('den åbnede sti ER manifestets start_url (drift-værn)', async () => {
      const { PWA_START_URL } = await import('../../utils/pwaInstallPrompt');

      // Ændres manifestet uden modulet, ville vi åbne en anden indgang end hjælpeprogrammets egen.
      expect(PWA_START_URL).toBe(manifest.start_url);
    });

    it('manifestet identificerer sig selv som relateret webapp', () => {
      expect(manifest.id).toBe(manifest.start_url);
      expect(manifest.related_applications).toEqual([
        { platform: 'webapp', url: '/manifest.json', id: manifest.id },
      ]);
    });

    it('manifestet fokuserer et eksisterende vindue frem for at åbne en dublet', () => {
      // Hele «Åbn program»-knappens løfte hviler på dette manifest-felt: uden det ville klikket
      // åbne endnu et PWA-vindue i stedet for at hente det frem, brugeren allerede har.
      expect(manifest.launch_handler.client_mode).toBe('focus-existing');
    });
  });
});

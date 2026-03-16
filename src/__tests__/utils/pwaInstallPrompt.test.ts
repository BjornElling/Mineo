import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('pwaInstallPrompt', () => {
  beforeEach(() => {
    vi.resetModules();
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

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(prompt).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'unavailable' });
  });
});

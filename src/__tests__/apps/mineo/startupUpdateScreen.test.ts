// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createStartupUpdateScreen, createStartupUpdateScreenScript } from '../../../apps/mineo/startupUpdateScreen';

describe('startupUpdateScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="root"><div id="mineo-startup-update" role="status" hidden>Vent venligst, opdatering indlæses</div></div><script type="module" src="/assets/index-ny.js"></script>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const runEarlyScript = async (cacheNames: string[], complete = true): Promise<void> => {
    vi.stubGlobal('caches', { keys: async () => cacheNames, match: async () => complete ? new Response('programkode') : undefined });
    new Function(createStartupUpdateScreenScript('ny'))();
    await Promise.resolve();
    await Promise.resolve();
  };

  it.each([
    { caches: [], visible: false },
    { caches: ['en-anden-app'], visible: false },
    { caches: ['mineo-build-assets:gammel'], visible: true },
    { caches: ['mineo-build-assets:gammel', 'mineo-build-assets:ny'], visible: false },
  ])('viser kun en ny build efter en tidligere installation: $caches', async ({ caches, visible }) => {
    await runEarlyScript(caches);
    expect(document.getElementById('mineo-startup-update')?.hidden).toBe(!visible);
  });

  it('forveksler ikke en tom cache efter afbrudt installation med en komplet opdatering', async () => {
    await runEarlyScript(['mineo-build-assets:gammel', 'mineo-build-assets:ny'], false);
    expect(document.getElementById('mineo-startup-update')?.hidden).toBe(false);
  });

  it('medregner HTML-visningen i minimumstiden og lukker for sene svar', async () => {
    await runEarlyScript(['mineo-build-assets:gammel']);
    // performance.now() indeholder brøkdele; nedrunding ville forkorte minimumsvisningen.
    await vi.advanceTimersByTimeAsync(700.5);
    const screen = createStartupUpdateScreen();
    screen.show();
    screen.close();
    let finished = false;
    const pending = screen.waitForMinimumDisplay().then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(299);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(finished).toBe(true);
  });

  it('lader hverken et sent cache-svar eller worker-signal vise skærmen efter opstart', async () => {
    const screen = createStartupUpdateScreen();
    screen.close();
    await runEarlyScript(['mineo-build-assets:gammel']);
    screen.show();
    await screen.waitForMinimumDisplay();
    expect(document.getElementById('mineo-startup-update')?.hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starter uden venteskærm, hvis cache-læsningen fejler', async () => {
    vi.stubGlobal('caches', { keys: async () => { throw new Error('lager blokeret'); } });
    new Function(createStartupUpdateScreenScript('ny'))();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('mineo-startup-update')?.hidden).toBe(true);
  });

  it('bruger programmets egne temafarver, så overgangen til programmet ikke skifter farve', () => {
    // HTML'en kan ikke læse app-stylesheetet, før programkoden er hentet; værdierne gentages derfor.
    const html = readFileSync('index.html', 'utf8');
    const layout = readFileSync('src/styles/layout.css', 'utf8');
    const block = (source: string, selector: string): string => {
      const start = source.indexOf(`${selector} {`);
      expect(start).toBeGreaterThanOrEqual(0);
      return source.slice(start, source.indexOf('}', start));
    };
    const token = (source: string, name: string): string | undefined =>
      new RegExp(`${name}:\\s*([^;]+);`).exec(source)?.[1]?.trim();

    const themes = [
      { screen: block(html, '#mineo-startup-update'), app: block(layout, ':root') },
      { screen: block(html, "html[data-mineo-theme='dark'] #mineo-startup-update"), app: block(layout, ":root[data-mineo-theme='dark']") },
    ];
    for (const { screen, app } of themes) {
      expect(token(screen, '--mineo-startup-update-surface')).toBe(token(app, '--color-surface'));
      expect(token(screen, '--mineo-startup-update-text')).toBe(token(app, '--color-text-primary'));
      expect(token(screen, '--mineo-startup-update-primary')).toBe(token(app, '--color-primary'));
    }
  });

  it('starter uden venteskærm og uden sidefejl, hvis cache-læsningen afviser synkront', () => {
    vi.stubGlobal('caches', { keys: () => { throw new DOMException('lager blokeret', 'SecurityError'); } });
    expect(() => new Function(createStartupUpdateScreenScript('ny'))()).not.toThrow();
    expect(document.getElementById('mineo-startup-update')?.hidden).toBe(true);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type WorkerEvent = Readonly<{
  waitUntil: ReturnType<typeof vi.fn>;
  data?: unknown;
  request?: Request;
}>;

type WorkerListener = (event: WorkerEvent) => void;

const loadServiceWorker = (options: {
  manifestAssets?: readonly string[];
  manifestResponseOk?: boolean;
} = {}) => {
  const listeners = new Map<string, WorkerListener>();
  const skipWaiting = vi.fn(() => Promise.resolve());
  const claim = vi.fn(() => Promise.resolve());
  const entries = new Map<string, Response>();
  const cache = {
    addAll: vi.fn(async (urls: readonly string[]) => {
      for (const url of urls) {
        const resolvedUrl = new URL(url, 'https://mineo.dk').toString();
        entries.set(resolvedUrl, new Response(`cached:${resolvedUrl}`));
      }
    }),
    match: vi.fn(async (request: Request) => entries.get(request.url)),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ['mineo-build-assets:2026.08.12']),
  };
  const fetch = vi.fn(async () => new Response(
    JSON.stringify({ assets: options.manifestAssets ?? ['assets/index-ABC123.js'] }),
    { status: options.manifestResponseOk === false ? 500 : 200 }
  ));
  const self = {
    location: {
      href: 'https://mineo.dk/sw.js?v=2026.08.12',
      origin: 'https://mineo.dk',
    },
    addEventListener: (type: string, listener: WorkerListener) => {
      listeners.set(type, listener);
    },
    skipWaiting,
    clients: { claim },
  };
  const source = readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
  vm.runInNewContext(source, { Promise, URL, Response, fetch, caches, self });
  return { listeners, skipWaiting, cache, fetch };
};

describe('service worker-opdateringsprotokol', () => {
  it('precacher hele den aktuelle builds immutable assets og lader derefter worker vente', async () => {
    const { listeners, skipWaiting, cache, fetch } = loadServiceWorker({
      manifestAssets: ['assets/index-ABC123.js', 'assets/pdf-DEF456.js'],
    });
    const install = listeners.get('install');
    expect(install).toBeDefined();

    const waitUntil = vi.fn();
    install?.({ waitUntil });
    await waitUntil.mock.calls[0]?.[0];

    expect(waitUntil).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/pwa-assets.json', { cache: 'no-store' });
    expect(cache.addAll).toHaveBeenCalledWith(['/assets/index-ABC123.js', '/assets/pdf-DEF456.js']);
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it('afviser installationen, hvis assetmanifestet ikke kan give en komplet sikker cache', async () => {
    const { listeners } = loadServiceWorker({ manifestResponseOk: false });
    const waitUntil = vi.fn();
    listeners.get('install')?.({ waitUntil });

    await expect(waitUntil.mock.calls[0]?.[0]).rejects.toThrow('PWA-assetmanifest kunne ikke hentes');
  });

  it('accepterer kun den kanoniske SKIP_WAITING-besked som aktivering', () => {
    const { listeners, skipWaiting } = loadServiceWorker();
    const message = listeners.get('message');
    expect(message).toBeDefined();

    message?.({ data: { type: 'IGNORER' }, waitUntil: vi.fn() });
    expect(skipWaiting).not.toHaveBeenCalled();

    const waitUntil = vi.fn();
    message?.({ data: { type: 'SKIP_WAITING' }, waitUntil });
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(skipWaiting).toHaveBeenCalledOnce();
  });

  it('besvarer kun cached immutable assets og lader app-shellen gå til netværket', async () => {
    const { listeners, cache, fetch } = loadServiceWorker();
    const installWaitUntil = vi.fn();
    listeners.get('install')?.({ waitUntil: installWaitUntil });
    await installWaitUntil.mock.calls[0]?.[0];

    const fetchListener = listeners.get('fetch');
    expect(fetchListener).toBeDefined();

    const assetRequest = new Request('https://mineo.dk/assets/index-ABC123.js');
    const assetWaitUntil = vi.fn();
    const assetRespondWith = vi.fn();
    fetchListener?.({
      request: assetRequest,
      respondWith: assetRespondWith,
      waitUntil: assetWaitUntil,
    } as unknown as WorkerEvent);
    const assetResponse = await assetRespondWith.mock.calls[0]?.[0];
    expect(await assetResponse.text()).toBe('cached:https://mineo.dk/assets/index-ABC123.js');
    expect(cache.match).toHaveBeenCalledWith(assetRequest);

    const shellRespondWith = vi.fn();
    fetchListener?.({
      request: new Request('https://mineo.dk/erstatningsopgoerelse'),
      respondWith: shellRespondWith,
      waitUntil: vi.fn(),
    } as unknown as WorkerEvent);
    expect(shellRespondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith(new Request('https://mineo.dk/erstatningsopgoerelse'));
  });
});

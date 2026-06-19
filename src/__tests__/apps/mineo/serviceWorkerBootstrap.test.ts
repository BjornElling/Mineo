// @vitest-environment jsdom

/**
 * Verificerer reload-disciplinen i service-worker-bootstrappen:
 *  - Første install (ingen controller ved load) må ALDRIG udløse reload, selvom `sw.js`'s
 *    `clients.claim()` fyrer `controllerchange` på et dokument der lige er booted.
 *  - En reel opdatering (controller fandtes ved load) reloader på `controllerchange`.
 *  - Reload sker højst én gang pr. dokument.
 *
 * Disse tests beskytter mod den uønskede hard-reload midt i første åbning, der ellers ville
 * kunne tabe ikke-gemt indtastning.
 */

type ControllerChangeListener = () => void;

type FakeServiceWorker = {
  state: ServiceWorker['state'];
  postMessage: ReturnType<typeof vi.fn>;
};

type FakeRegistration = {
  installing: FakeServiceWorker | null;
  waiting: FakeServiceWorker | null;
  update: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
};

const setProd = (value: boolean): void => {
  vi.stubEnv('PROD', value);
};

const buildServiceWorkerContainer = (options: {
  controller: ServiceWorker | null;
  registration: FakeRegistration;
}) => {
  const controllerChangeListeners: ControllerChangeListener[] = [];
  const container = {
    controller: options.controller,
    register: vi.fn(async () => options.registration),
    ready: Promise.resolve(options.registration as unknown as ServiceWorkerRegistration),
    addEventListener: vi.fn((type: string, listener: ControllerChangeListener) => {
      if (type === 'controllerchange') controllerChangeListeners.push(listener);
    }),
  };
  const fireControllerChange = (): void => {
    for (const listener of [...controllerChangeListeners]) listener();
  };
  return { container, fireControllerChange };
};

const buildRegistration = (): FakeRegistration => ({
  installing: null,
  waiting: null,
  update: vi.fn(async () => undefined),
  addEventListener: vi.fn(),
});

describe('serviceWorkerBootstrap reload-disciplin', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    setProd(true);
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/', reload: reloadSpy },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reloader IKKE ved første install (ingen controller ved load), selv når controllerchange fyrer', async () => {
    const registration = buildRegistration();
    const { container, fireControllerChange } = buildServiceWorkerContainer({
      controller: null,
      registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const { ensureLatestServiceWorkerBeforeRender } = await import(
      '../../../apps/mineo/serviceWorkerBootstrap'
    );
    await ensureLatestServiceWorkerBeforeRender();

    // sw.js's clients.claim() ville fyre controllerchange efter første aktivering:
    fireControllerChange();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reloader ALDRIG i et første-install-dokument, heller ikke ved en senere controllerchange', async () => {
    // Bevidst konservativ adfærd: et dokument der loadede uden controller (første install)
    // auto-reloader aldrig — heller ikke hvis en ny version aktiveres senere i samme dokument.
    // `controllerExistedAtLoad` (ikke `{once:true}`-listeneren) er den gate der styrer dette;
    // opdateringen tages i brug ved næste åbning. Denne test værner mod, at gaten fjernes ved
    // en fejlagtig "fix", fordi den fremstår overflødig.
    const registration = buildRegistration();
    const { container, fireControllerChange } = buildServiceWorkerContainer({
      controller: null,
      registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const { ensureLatestServiceWorkerBeforeRender } = await import(
      '../../../apps/mineo/serviceWorkerBootstrap'
    );
    await ensureLatestServiceWorkerBeforeRender();

    // Første-install-claim fyrer controllerchange, og senere aktiverer en ny version også:
    fireControllerChange();
    fireControllerChange();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reloader netop én gang ved en reel opdatering (controller fandtes ved load)', async () => {
    const registration = buildRegistration();
    const existingController = { state: 'activated' } as unknown as ServiceWorker;
    const { container, fireControllerChange } = buildServiceWorkerContainer({
      controller: existingController,
      registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const { ensureLatestServiceWorkerBeforeRender } = await import(
      '../../../apps/mineo/serviceWorkerBootstrap'
    );
    await ensureLatestServiceWorkerBeforeRender();

    // En ventende worker aktiverer → controllerchange fyrer (evt. mere end én gang).
    fireControllerChange();
    fireControllerChange();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('gør intet uden for produktion', async () => {
    setProd(false);
    const registration = buildRegistration();
    const { container } = buildServiceWorkerContainer({ controller: null, registration });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const { ensureLatestServiceWorkerBeforeRender } = await import(
      '../../../apps/mineo/serviceWorkerBootstrap'
    );
    await ensureLatestServiceWorkerBeforeRender();

    expect(container.register).not.toHaveBeenCalled();
  });

  it('springer registrering over på PWA-file-open-ruten (/open)', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/open', reload: reloadSpy },
    });
    const registration = buildRegistration();
    const { container } = buildServiceWorkerContainer({ controller: null, registration });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const { ensureLatestServiceWorkerBeforeRender } = await import(
      '../../../apps/mineo/serviceWorkerBootstrap'
    );
    await ensureLatestServiceWorkerBeforeRender();

    expect(container.register).not.toHaveBeenCalled();
  });
});

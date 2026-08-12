// @vitest-environment jsdom

/**
 * Verificerer opdateringsdisciplinen i service-worker-bootstrappen:
 *  - En ventende worker annonceres, men tager aldrig en aktiv sag over automatisk.
 *  - Først brugerens eksplicitte accept sender SKIP_WAITING.
 *  - Reload sker præcis én gang og først efter den accepterede workers controllerchange.
 */

type ControllerChangeListener = () => void;
type StateChangeListener = () => void;

type FakeServiceWorker = {
  state: ServiceWorker['state'];
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
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

const buildServiceWorker = (state: ServiceWorker['state']): FakeServiceWorker => {
  const listeners: StateChangeListener[] = [];
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: StateChangeListener) => {
      if (type === 'statechange') listeners.push(listener);
    }),
  };
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

const buildRegistration = (waiting: FakeServiceWorker | null = null): FakeRegistration => ({
  installing: null,
  waiting,
  update: vi.fn(async () => undefined),
  addEventListener: vi.fn(),
});

describe('serviceWorkerBootstrap opdateringsdisciplin', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let resetBootstrap: () => void;

  beforeEach(async () => {
    vi.resetModules();
    setProd(true);
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/', reload: reloadSpy },
    });
    const bootstrap = await import('../../../apps/mineo/serviceWorkerBootstrap');
    resetBootstrap = bootstrap.__resetServiceWorkerBootstrapForTests;
  });

  afterEach(() => {
    resetBootstrap();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('annoncerer en ventende opdatering uden at genindlæse automatisk', async () => {
    const waiting = buildServiceWorker('installed');
    const registration = buildRegistration(waiting);
    const existingController = { state: 'activated' } as unknown as ServiceWorker;
    const { container, fireControllerChange } = buildServiceWorkerContainer({
      controller: existingController,
      registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const {
      ensureLatestServiceWorkerBeforeRender,
      getServiceWorkerUpdateStatus,
    } = await import('../../../apps/mineo/serviceWorkerBootstrap');
    await ensureLatestServiceWorkerBeforeRender();

    expect(getServiceWorkerUpdateStatus()).toBe('ready');
    expect(waiting.postMessage).not.toHaveBeenCalled();

    // Selv en controllerchange uden brugeraccept må aldrig rive den aktive sag ned.
    fireControllerChange();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('aktiverer og genindlæser kun efter brugerens eksplicitte accept', async () => {
    const waiting = buildServiceWorker('installed');
    const registration = buildRegistration(waiting);
    const existingController = { state: 'activated' } as unknown as ServiceWorker;
    const { container, fireControllerChange } = buildServiceWorkerContainer({
      controller: existingController,
      registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const {
      activateAvailableServiceWorkerUpdate,
      ensureLatestServiceWorkerBeforeRender,
      getServiceWorkerUpdateStatus,
    } = await import('../../../apps/mineo/serviceWorkerBootstrap');
    await ensureLatestServiceWorkerBeforeRender();

    expect(activateAvailableServiceWorkerUpdate()).toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(getServiceWorkerUpdateStatus()).toBe('activating');
    expect(reloadSpy).not.toHaveBeenCalled();

    fireControllerChange();
    fireControllerChange();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('aktiverer første install før app-render uden at annoncere eller genindlæse', async () => {
    const waiting = buildServiceWorker('installed');
    const registration = buildRegistration(waiting);
    const { container, fireControllerChange } = buildServiceWorkerContainer({
      controller: null,
      registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });

    const {
      ensureLatestServiceWorkerBeforeRender,
      getServiceWorkerUpdateStatus,
    } = await import('../../../apps/mineo/serviceWorkerBootstrap');
    await ensureLatestServiceWorkerBeforeRender();

    expect(getServiceWorkerUpdateStatus()).toBe('idle');
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    fireControllerChange();
    expect(reloadSpy).not.toHaveBeenCalled();
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

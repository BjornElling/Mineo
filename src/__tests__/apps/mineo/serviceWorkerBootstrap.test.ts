// @vitest-environment jsdom

/**
 * Verificerer det ene invariant bag opdateringsmodellen:
 *
 *   «En ny session starter altid på den nyeste version, der kan klargøres KOMPLET.
 *    En åben session skifter aldrig version.»
 *
 * Testene måler derfor to ting: at der genindlæses PRÆCIS når en ny version er komplet precachet,
 * og at der ALDRIG genindlæses, når klargøringen er usikker (offline, mislykket precache, timeout,
 * uskrivbart løkkeværn). Fail-safe er lige så vigtigt som fail-fast: en halv opdatering er værre end
 * en hel, lidt ældre version.
 */

type StateChangeListener = () => void;

type FakeServiceWorker = {
  state: ServiceWorker['state'];
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setState: (state: ServiceWorker['state']) => void;
};

type FakeRegistration = {
  installing: FakeServiceWorker | null;
  waiting: FakeServiceWorker | null;
  update: ReturnType<typeof vi.fn>;
};

const DOCUMENT_VERSION = '2026.08.12';
const DEPLOYED_NEWER_VERSION = '2026.08.13';

const stubDeployedVersion = (deployedVersion: string | null): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn(async () => {
    if (deployedVersion === null) throw new Error('offline');
    return new Response(JSON.stringify({ version: deployedVersion, assets: ['assets/index-A.js'] }), {
      status: 200,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Manifest-svar der skifter version pr. kald — modellerer en delvis udrullet/flappende origin. */
const stubFlappingDeployedVersions = (versions: readonly string[]): void => {
  let callIndex = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    const version = versions[Math.min(callIndex++, versions.length - 1)];
    return new Response(JSON.stringify({ version, assets: ['assets/index-A.js'] }), { status: 200 });
  }));
};

/**
 * `.eo`-handoff-barrieren mockes pr. test. Standard er «bekræftet persisteret», så kun den test,
 * der måler netop dét værn, ser en afvist handoff.
 */
const mockDurableHandoff = (result: boolean): void => {
  vi.doMock('../../../utils/pwaLaunchQueue', () => ({
    awaitDurablePendingPwaFileOpenHandoff: vi.fn(async () => result),
  }));
};

/**
 * `autoActivateOnSkipWaiting` modellerer browserens virkelige adfærd: en ventende worker bliver
 * `activated`, når `skipWaiting()` er kaldt. Sættes den til `false`, kan testen måle det modsatte —
 * at en worker, der ALDRIG bliver aktiv, heller aldrig må udløse en genindlæsning.
 */
const buildServiceWorker = (
  state: ServiceWorker['state'],
  options: { autoActivateOnSkipWaiting?: boolean } = {},
): FakeServiceWorker => {
  const listeners: StateChangeListener[] = [];
  const worker: FakeServiceWorker = {
    state,
    postMessage: vi.fn((message: unknown) => {
      const isSkipWaiting = (message as { type?: unknown } | null)?.type === 'SKIP_WAITING';
      if (!isSkipWaiting) return;
      if (options.autoActivateOnSkipWaiting === false) return;
      worker.setState('activated');
    }),
    addEventListener: vi.fn((type: string, listener: StateChangeListener) => {
      if (type === 'statechange') listeners.push(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: StateChangeListener) => {
      if (type !== 'statechange') return;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    }),
    setState: (nextState) => {
      worker.state = nextState;
      for (const listener of [...listeners]) listener();
    },
  };
  return worker;
};

const buildRegistration = (options: {
  installing?: FakeServiceWorker | null;
  waiting?: FakeServiceWorker | null;
} = {}): FakeRegistration => ({
  installing: options.installing ?? null,
  waiting: options.waiting ?? null,
  update: vi.fn(async () => undefined),
});

const buildServiceWorkerContainer = (
  registration: FakeRegistration | null,
  options: { controller?: ServiceWorker | null } = {},
) => {
  const container = {
    controller: options.controller === undefined
      ? ({ state: 'activated' } as unknown as ServiceWorker)
      : options.controller,
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => registration ?? undefined),
    ready: Promise.resolve(registration as unknown as ServiceWorkerRegistration),
    addEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  return container;
};

/**
 * jsdom's `sessionStorage` er en proxy, som `vi.spyOn` ikke kan gribe. Hele objektet erstattes
 * derfor, når en skrivefejl skal simuleres — værnet skal netop bevise, at et ikke-skrivbart lager
 * stopper genindlæsningen.
 */
const withUnwritableSessionStorage = (): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {
        throw new Error('kvote opbrugt');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    },
  });
  return () => {
    if (original) Object.defineProperty(window, 'sessionStorage', original);
  };
};

describe('serviceWorkerBootstrap — ny session = ny version, åben session urørt', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let resetBootstrap: () => void;
  let restoreSessionStorage: (() => void) | null = null;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_APP_VERSION', DOCUMENT_VERSION);
    window.sessionStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/', reload: reloadSpy },
    });
    stubDeployedVersion(DOCUMENT_VERSION);
    mockDurableHandoff(true);
    const bootstrap = await import('../../../apps/mineo/serviceWorkerBootstrap');
    resetBootstrap = bootstrap.__resetServiceWorkerBootstrapForTests;
  });

  afterEach(() => {
    resetBootstrap();
    restoreSessionStorage?.();
    restoreSessionStorage = null;
    window.sessionStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('../../../utils/pwaLaunchQueue');
    vi.restoreAllMocks();
  });

  const importBootstrap = async () => import('../../../apps/mineo/serviceWorkerBootstrap');

  it('renderer straks uden reload, når den udrullede version er dokumentets egen', async () => {
    // Den normale vej: ingen ny version ⇒ ingen ventetid overhovedet.
    buildServiceWorkerContainer(buildRegistration());

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('aktiverer den ventende worker og genindlæser, når en komplet ny version står klar', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const waiting = buildServiceWorker('installed');
    buildServiceWorkerContainer(buildRegistration({ waiting }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    // `SKIP_WAITING` er nødvendig: en ventende worker aktiverer ellers først ved NUL klienter, og
    // en genindlæsning når aldrig nul.
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('sender aktiveringsbeskeden til den konkrete installerede worker', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const installing = buildServiceWorker('installed');
    // Browseren kan nå at flytte worker-reference mellem installationens statechange og
    // klientens besked. Reload må ikke afhænge af, at registration.waiting stadig er udfyldt.
    buildServiceWorkerContainer(buildRegistration({ installing, waiting: null }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('venter på at precachen bliver komplet, før der genindlæses', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const installing = buildServiceWorker('installing');
    const registration = buildRegistration({ installing });
    buildServiceWorkerContainer(registration);

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    const pending = ensureLatestVersionBeforeRender();

    // Endnu ikke komplet ⇒ ingen genindlæsning.
    expect(reloadSpy).not.toHaveBeenCalled();

    // Precachen bliver færdig; workeren står nu som `waiting`, præcis som i browseren.
    registration.waiting = installing;
    installing.setState('installed');
    await pending;

    // …og først efter den bekræftede aktivering genindlæses der.
    expect(installing.state).toBe('activated');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('genindlæser IKKE, når precachen mislykkes (redundant)', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const installing = buildServiceWorker('installing');
    buildServiceWorkerContainer(buildRegistration({ installing }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    const pending = ensureLatestVersionBeforeRender();
    installing.setState('redundant');
    await pending;

    // En halv opdatering er værre end ingen: fail-safe til nuværende version.
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('genindlæser IKKE, når installationen hænger (timeout-værn)', async () => {
    vi.useFakeTimers();
    try {
      stubDeployedVersion(DEPLOYED_NEWER_VERSION);
      const installing = buildServiceWorker('installing');
      buildServiceWorkerContainer(buildRegistration({ installing }));

      const { ensureLatestVersionBeforeRender } = await importBootstrap();
      const pending = ensureLatestVersionBeforeRender();
      await vi.advanceTimersByTimeAsync(20000);
      await pending;

      expect(reloadSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('genindlæser IKKE, når den udrullede version ikke kan opløses (offline)', async () => {
    stubDeployedVersion(null);
    buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    // Et usikkert svar må aldrig udløse en genindlæsning.
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('genindlæser præcis én gang for samme udrullede version (løkkeværn)', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));

    const first = await importBootstrap();
    await first.ensureLatestVersionBeforeRender();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // Anden opstart mod SAMME udrullede version (markøren står i sessionStorage): ingen løkke.
    first.__resetServiceWorkerBootstrapForTests();
    vi.resetModules();
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));
    const second = await importBootstrap();
    await second.ensureLatestVersionBeforeRender();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('genindlæser IKKE, når løkkeværnets markør ikke kan skrives', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));
    restoreSessionStorage = withUnwritableSessionStorage();

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    // Et uspærret reload er værre end den lidt ældre kode, det skulle rette.
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('genindlæser IKKE, når registreringen fejler', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const container = buildServiceWorkerContainer(null);
    container.register = vi.fn(async () => {
      throw new Error('registrering afvist');
    });

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('gør intet uden for PROD', async () => {
    vi.stubEnv('PROD', false);
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const container = buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(container.register).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('efter render aktiveres en ventende worker ALDRIG (åben session skifter ikke version)', async () => {
    // Kernen i invariantets anden halvdel: opstartsfasen er slut, så selv en komplet ny version
    // må hverken aktiveres eller genindlæses under en igangværende sag.
    buildServiceWorkerContainer(buildRegistration());
    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    reloadSpy.mockClear();
    const waiting = buildServiceWorker('installed');
    buildServiceWorkerContainer(buildRegistration({ waiting }));

    // Der findes bevidst ingen efter-render-indgang at kalde: modellen har hverken periodiske tjek
    // eller en opdateringslinje. Ingen aktivering, ingen genindlæsning.
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('genindlæser IKKE, når den nye worker er installeret men aldrig bliver aktiv', async () => {
    // Kernefundet: `installed` er IKKE en tilstrækkelig barriere. Et dokument beholder sin controller
    // hele sin levetid, så en genindlæsning her ville starte den NYE build under den GAMLE worker —
    // hvorefter det nye dokument ser «samme version» og aldrig fuldfører skiftet.
    vi.useFakeTimers();
    try {
      stubDeployedVersion(DEPLOYED_NEWER_VERSION);
      const waiting = buildServiceWorker('installed', { autoActivateOnSkipWaiting: false });
      buildServiceWorkerContainer(buildRegistration({ waiting }));

      const { ensureLatestVersionBeforeRender } = await importBootstrap();
      const pending = ensureLatestVersionBeforeRender();
      await vi.advanceTimersByTimeAsync(20000);
      await pending;

      expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(reloadSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('genindlæser først EFTER at den nye worker er bekræftet aktiv', async () => {
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    const waiting = buildServiceWorker('installed');
    buildServiceWorkerContainer(buildRegistration({ waiting }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(waiting.state).toBe('activated');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('går i ro ved en flappende origin i stedet for at genindlæse i ring', async () => {
    // Delvis udrullet CDN: HTML forbliver V1, mens manifestet skiftevis melder V2 og V3. Et løkkeværn
    // med kun «sidst sete version» ville lade hvert svar se nyt ud og reloade i ring.
    stubFlappingDeployedVersions([DEPLOYED_NEWER_VERSION, '2026.08.14', DEPLOYED_NEWER_VERSION]);

    for (let boot = 0; boot < 3; boot += 1) {
      const bootstrap = await importBootstrap();
      bootstrap.__resetServiceWorkerBootstrapForTests();
      buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));
      await bootstrap.ensureLatestVersionBeforeRender();
    }

    // Hvert versionsspring forsøges præcis én gang: to distinkte mål ⇒ højst to genindlæsninger.
    expect(reloadSpy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('genindlæser IKKE, når en pending .eo-request ikke kan bekræftes persisteret', async () => {
    // Brugerens fil vejer tungere end at komme på nyeste version straks: en genindlæsning her ville
    // kaste den netop åbnede `.eo`-fil væk, mens IndexedDB-skrivningen stadig var undervejs.
    vi.resetModules();
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    mockDurableHandoff(false);
    buildServiceWorkerContainer(buildRegistration({ waiting: buildServiceWorker('installed') }));

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('genindlæser IKKE ved første besøg uden controller', async () => {
    // Uden en controller er der ingen GAMMEL worker at fortrænge: dokumentet kører allerede den HTML,
    // origin lige leverede. Et reload ville hverken skifte kode eller vinde en versionscache for
    // netop dette dokument — kun koste brugeren en ekstra opstart.
    stubDeployedVersion(DEPLOYED_NEWER_VERSION);
    buildServiceWorkerContainer(
      buildRegistration({ waiting: buildServiceWorker('installed') }),
      { controller: null },
    );

    const { ensureLatestVersionBeforeRender } = await importBootstrap();
    await ensureLatestVersionBeforeRender();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('eksporterer ingen opdateringslinje-API længere', async () => {
    // Deriveret værn: dukker en status-/aktiverings-API op igen, er opdateringslinjen på vej tilbage.
    const bootstrap: Record<string, unknown> = await importBootstrap();
    expect(bootstrap.getServiceWorkerUpdateStatus).toBeUndefined();
    expect(bootstrap.subscribeServiceWorkerUpdateStatus).toBeUndefined();
    expect(bootstrap.activateAvailableServiceWorkerUpdate).toBeUndefined();
    expect(bootstrap.setupServiceWorkerUpdateChecks).toBeUndefined();
  });
});

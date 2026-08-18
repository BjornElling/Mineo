import os from 'node:os';

/**
 * Maskinprofil for Playwright-kørslen.
 *
 * Baggrund: den samme E2E-suite er grøn på en kraftig stationær maskine og i GitHub Actions,
 * men fejlede på en svagere bærbar med `browserContext.newPage: Target crashed` i otte samtidige
 * Chromium-workers samt spredte timeouts. Playwrights standard vælger workers alene ud fra
 * kernetal. Den kender hverken maskinens hukommelse eller dens faktiske hastighed, så en bærbar
 * med lige så mange logiske kerner — men langsommere kerner og halvt så meget RAM — får præcis
 * samme parallelitet som referencemaskinen og løber tør for begge dele.
 *
 * Profilen måler de tre størrelser, der reelt afgør hvor meget maskinen kan bære, og oversætter
 * dem til et worker-antal og en timeout-faktor. Den er bevidst asymmetrisk: den kan kun gøre
 * kørslen mere tålmodig og mindre parallel, aldrig mere aggressiv. På referencemaskinen — og på
 * alt hurtigere — producerer den nøjagtig de tal, konfigurationen havde i forvejen, så hverken
 * den stationære maskine eller CI ændrer adfærd.
 *
 * Timeout-faktoren hæver kun lofter. Ingen test venter på sin timeout, så en højere grænse gør
 * ingen kørsel langsommere; den flytter alene skillelinjen mellem «maskinen er langsom» og
 * «flowet hænger». En hængende test fejler fortsat.
 */

/**
 * Referencemålingen fra den maskine, hvor suiten er kalibreret og grøn (AMD Ryzen 7 7700X,
 * 16 logiske kerner, 32 GiB). Målingen er stabil inden for ±5 % på tværs af kørsler, og alt
 * hurtigere end referencen klemmes til faktor 1 — konstanten kan derfor kun gøre langsommere
 * maskiner mere tålmodige, ikke referencemaskinen mindre.
 */
export const REFERENCE_PROBE_MS = 31;

/**
 * Måletolerance. Almindelig baggrundsbelastning på en hurtig maskine kan flytte proben nogle få
 * procent; først en maskine der er mærkbart langsommere end referencen skal ændre kørslen.
 */
const SPEED_DEADBAND = 1.25;

/** Loft over hvor langsom en maskine må regnes for. Beskytter mod en enkelt vildfaren måling. */
const MAX_SLOWNESS = 3;

/** Hukommelse der holdes fri til operativsystem, Node-processen og den lokale E2E-server. */
const RESERVED_MEMORY_GIB = 4;

/**
 * Hukommelsesbudget pr. worker. En worker holder en browser med Mineos fulde UI og trace-opsamling
 * i live. Tre GiB giver den målte 15,7 GiB Windows-bærbar tre workers; fire samtidige
 * Firefox-kontekster fejlede sporadisk ved lukning, før Playwright rapporterede pres.
 *
 * Tallet er BEVIDST ikke sat ned, selv om videooptagelsen er slået fra (jf. `playwright.config.ts`).
 * Den frigjorte hukommelse går til luft omkring den kendte crash-grænse, ikke til en fjerde worker:
 * kørslen er allerede gjort markant kortere af banemodellen, og en genindført ressourcecrash ville
 * koste mere end de sparede minutter.
 */
const MEMORY_PER_WORKER_GIB = 3;

const BYTES_PER_GIB = 1024 ** 3;

export interface MachineCapacity {
  /** Logiske kerner til rådighed for processen. */
  readonly logicalCpus: number;
  /** Fysisk hukommelse i GiB. */
  readonly totalMemoryGiB: number;
  /** Målt langsomhed i forhold til referencemaskinen. 1 = lige så hurtig eller hurtigere. */
  readonly slownessFactor: number;
}

export interface MachineProfileOverrides {
  /** `PLAYWRIGHT_WORKERS` — eksplicit worker-antal, fx til at reproducere en konkret kørsel. */
  readonly workers?: number | undefined;
  /** `PLAYWRIGHT_TIMEOUT_SCALE` — eksplicit timeout-faktor. */
  readonly timeoutScale?: number | undefined;
}

export interface MachineProfile {
  readonly workers: number;
  readonly timeoutScale: number;
  /** Det worker-antal Playwright selv ville have valgt. Bruges til at afgøre om profilen afviger. */
  readonly playwrightDefaultWorkers: number;
  /** Sand når maskinen er svagere end referencen, og profilen derfor griber ind. */
  readonly reduced: boolean;
}

/**
 * Læser en positiv talværdi fra en miljøvariabel. Tom, ugyldig eller ikke-positiv værdi giver
 * `undefined`, så en fejlskrevet override falder tilbage til den målte profil i stedet for at
 * sætte kørslen til noget meningsløst.
 */
export const parsePositiveNumberEnv = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

/**
 * Oversætter en målt maskinkapacitet til worker-antal og timeout-faktor. Ren funktion — al måling
 * og miljølæsning ligger uden for, så reglerne kan testes uden en bestemt maskine.
 */
export const deriveMachineProfile = (
  capacity: MachineCapacity,
  overrides: MachineProfileOverrides = {},
): MachineProfile => {
  const slowness = Math.min(
    Math.max(capacity.slownessFactor < SPEED_DEADBAND ? 1 : capacity.slownessFactor, 1),
    MAX_SLOWNESS,
  );

  // Playwrights egen standard: halvdelen af de logiske kerner.
  const byCpu = Math.max(1, Math.floor(capacity.logicalCpus / 2));

  const byMemory = Math.max(
    1,
    Math.floor((capacity.totalMemoryGiB - RESERVED_MEMORY_GIB) / MEMORY_PER_WORKER_GIB),
  );

  // Langsomme kerner dæmpes med kvadratroden, ikke lineært: CPU-hastighed er ikke det, der får en
  // browser-target til at crashe — det er hukommelsen, og den har sit eget hårde loft ovenfor.
  // En langsom maskine skal have mindre samtidighedspres, men ikke betale for det med en kørsel,
  // der tager fire gange så lang tid.
  const bySpeed = Math.max(1, Math.round(byCpu / Math.sqrt(slowness)));

  const workers = overrides.workers === undefined
    ? Math.min(byCpu, byMemory, bySpeed)
    : Math.max(1, Math.floor(overrides.workers));

  const timeoutScale = overrides.timeoutScale === undefined
    ? slowness
    : Math.max(1, overrides.timeoutScale);

  return {
    workers,
    timeoutScale,
    playwrightDefaultWorkers: byCpu,
    reduced: workers < byCpu || timeoutScale > 1,
  };
};

/**
 * Fast CPU-arbejde, hvis varighed sammenlignes med referencemaskinens. Resultatet forbruges til
 * sidst, fordi en løkke uden observerbart resultat kan optimeres helt væk af JIT'en — så ville
 * proben måle nul og gøre enhver maskine «hurtig».
 */
const PROBE_ITERATIONS = 3_000_000;
const PROBE_SAMPLES = 3;

const runProbe = (): number => {
  const start = performance.now();
  let accumulator = 0;
  for (let index = 1; index <= PROBE_ITERATIONS; index += 1) {
    accumulator += Math.sqrt(index) % 7;
  }
  const elapsedMs = performance.now() - start;
  if (!Number.isFinite(accumulator)) {
    throw new Error('CPU-proben producerede et ugyldigt resultat.');
  }
  return elapsedMs;
};

const measureFastestProbeMs = (): number => {
  // Første kørsel betaler for JIT-kompileringen og tælles ikke med.
  runProbe();
  let fastest = Number.POSITIVE_INFINITY;
  for (let sample = 0; sample < PROBE_SAMPLES; sample += 1) {
    fastest = Math.min(fastest, runProbe());
  }
  return fastest;
};

/**
 * Playwright indlæser konfigurationen igen i hver worker-proces. Uden en delt måling ville hver
 * worker køre sin egen probe under fuld belastning fra de øvrige workers og nå frem til et andet
 * timeout-loft end hovedprocessen. Målingen fra hovedprocessen arves derfor gennem miljøet, så
 * hele kørslen bruger ét og samme tal.
 */
const PROBE_ENV_KEY = 'MINEO_E2E_PROBE_MS';

const resolveProbeMs = (): number => {
  const inherited = parsePositiveNumberEnv(process.env[PROBE_ENV_KEY]);
  if (inherited !== undefined) return inherited;

  const measured = measureFastestProbeMs();
  process.env[PROBE_ENV_KEY] = measured.toFixed(2);
  return measured;
};

export const measureMachineCapacity = (): MachineCapacity => ({
  // `os.cpus().length` — ikke `availableParallelism()` — fordi Playwrights egen standard («50 %»)
  // regner på netop dét tal. Samme kilde er det, der gør profilen til en ægte no-op på en maskine,
  // som ikke er svagere end referencen.
  logicalCpus: os.cpus().length,
  totalMemoryGiB: os.totalmem() / BYTES_PER_GIB,
  slownessFactor: resolveProbeMs() / REFERENCE_PROBE_MS,
});

export const resolveMachineProfile = (): MachineProfile =>
  deriveMachineProfile(measureMachineCapacity(), {
    workers: parsePositiveNumberEnv(process.env.PLAYWRIGHT_WORKERS),
    timeoutScale: parsePositiveNumberEnv(process.env.PLAYWRIGHT_TIMEOUT_SCALE),
  });

/**
 * Én linje til den, der kører suiten på en svagere maskine, så det nedsatte worker-antal og de
 * hævede lofter er synlige frem for at ligne uforklarlig langsomhed. Skrives kun i hovedprocessen
 * (workers har `TEST_WORKER_INDEX` sat) og kun når profilen faktisk afviger fra standarden.
 */
export const reportMachineProfile = (profile: MachineProfile): void => {
  if (!profile.reduced) return;
  if (process.env.TEST_WORKER_INDEX !== undefined) return;

  console.log(
    `[mineo] Svagere maskine end referencen: ${profile.workers} workers `
    + `(standard ville være ${profile.playwrightDefaultWorkers}), `
    + `timeout-lofter ×${profile.timeoutScale.toFixed(2)}. `
    + 'Sæt PLAYWRIGHT_WORKERS eller PLAYWRIGHT_TIMEOUT_SCALE for at overstyre.',
  );
};

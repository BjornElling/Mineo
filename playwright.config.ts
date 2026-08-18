import { defineConfig, devices } from '@playwright/test';
import { reportMachineProfile, resolveMachineProfile } from './e2e/support/machineProfile';
import { BROWSER_LANE_TAG, VIEWPORT_LANE_TAG } from './e2e/support/lanes';

const defaultBaseURL = 'http://127.0.0.1:4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
const useExternalWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const allowServiceWorkers = process.env.PLAYWRIGHT_ALLOW_SERVICE_WORKERS === '1';
const runFullMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === '1';

// Playwrights viewportværdier er den indre CSS-viewport. Basisviewporten er den tidligere
// desktopbaseline; de to minimumsviewporter er app-shell-kontraktens konkrete grænser.
const baselineViewport = { width: 1536, height: 864 } as const;
const compactMinimumViewport = { width: 1536, height: 730 } as const;
const narrowMinimumViewport = { width: 1366, height: 620 } as const;
const fullHdViewport = { width: 1920, height: 1080 } as const;
const largerDesktopViewport = { width: 2560, height: 1440 } as const;

/**
 * Browsermotorerne. Navnene er uændrede, så `--project=<navn>` og CI-matrixen peger på det samme
 * som før. Chrome står først: den er basisbanens motor.
 */
const engines = [
  { key: 'chrome-desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  { key: 'edge-desktop', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  { key: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
  { key: 'safari-webkit-desktop', use: { ...devices['Desktop Safari'] } },
] as const;

const viewports = [
  { suffix: '', viewport: baselineViewport },
  { suffix: '-1536x730', viewport: compactMinimumViewport },
  { suffix: '-1366x620', viewport: narrowMinimumViewport },
  { suffix: '-full-hd', viewport: fullHdViewport },
] as const;

type EngineDefinition = (typeof engines)[number];
type ViewportDefinition = (typeof viewports)[number];

const buildProject = (
  engine: EngineDefinition,
  { suffix, viewport }: ViewportDefinition,
  laneTag?: string,
) => ({
  name: `${engine.key}${suffix}`,
  use: { ...engine.use, viewport },
  // Playwright matcher `grep` mod testens fulde titel inklusive dens tags.
  ...(laneTag === undefined ? {} : { grep: new RegExp(`${laneTag}\\b`) }),
});

/**
 * **Banemodellen.** Suiten kørte før hver eneste test i alle 16 kombinationer af fire browsere og
 * fire viewporter — 1232 kørsler af 77 tests. Det tog omkring tre kvarter, og langt det meste af
 * tiden gik til at bevise den samme browseruafhængige brugerrejse femten gange for meget. Det gjorde
 * suiten så dyr at køre, at den i praksis ikke blev kørt, og en kørsel der bliver afbrudt beskytter
 * ingenting.
 *
 * Nu vælger den enkelte test selv sin bane med et tag:
 *
 *  - **Ingen tag → basisbanen.** Kører én gang, i Chrome ved basisviewporten. Det er det rigtige
 *    valg for alt, der handler om Mineos egen adfærd: felter, dialoger, beregningsflader, fejl-UI.
 *  - **`@browsere` → browserbanen.** Kører desuden i Edge, Firefox og WebKit. Vælges når adfærden
 *    afhænger af browsermotoren: fokus- og Tab-semantik, filvælger-fallbacks, animation, tekstmål.
 *  - **`@viewporter` → viewportbanen.** Kører desuden ved de to minimumsviewporter. Vælges når
 *    testen aflæser den viewport, projektet giver den, i stedet for at sætte sin egen.
 *
 * En test uden tag er altså ikke udækket — den er dækket ét sted. Det er et bevidst valg: en fejl,
 * der kun findes i én motor, findes af de tests der er tagget til at lede efter netop dét, og
 * `PLAYWRIGHT_FULL_MATRIX=1` kører fortsat hele den gamle matrix, når en bred efterkontrol er
 * formålet. `scripts/check-e2e-lane-tags.mjs` fanger et fejlstavet tag, som ellers tavst ville
 * betyde «kører ingen steder ekstra».
 */
const laneProjects = [
  // Basisbanen: alt kører her, uanset tag.
  buildProject(engines[0], viewports[0]),
  // Browserbanen: samme viewport, kun de tests der beder om flere motorer.
  ...engines.slice(1).map((engine) => buildProject(engine, viewports[0], BROWSER_LANE_TAG)),
  // Viewportbanen: samme motor, kun de tests der aflæser projektets viewport.
  ...viewports.slice(1, 3).map((viewport) => buildProject(engines[0], viewport, VIEWPORT_LANE_TAG)),
];

const fullMatrixProjects = engines.flatMap((engine) =>
  viewports.map((viewport) => buildProject(engine, viewport)));

const projects = runFullMatrix
  ? [
    ...fullMatrixProjects,
    ...(process.env.PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT === '1'
      ? fullMatrixProjects.map((project) => ({
        name: `${project.name}-large`,
        use: { ...project.use, viewport: largerDesktopViewport },
      }))
      : []),
  ]
  : laneProjects;

// Suiten køres både på en kraftig stationær maskine, i CI og på en svagere bærbar. Profilen måler
// maskinens kerner, hukommelse og faktiske hastighed og skruer parallelitet og timeout-lofter
// derefter. På referencemaskinen og i CI giver den præcis de værdier, konfigurationen havde før.
const machineProfile = resolveMachineProfile();
reportMachineProfile(machineProfile);

const scaleTimeout = (baseMs: number): number => Math.round(baseMs * machineProfile.timeoutScale);

// Vites dev-server transformerer lazy moduler på efterspørgsel. Med flere browser-workers kan to
// samtidige første besøg i samme route derfor få et kortvarigt mislykket modul-svar. E2E-suiten
// skal dokumentere browseradfærd, ikke Vites transform-cacheløb, og kører derfor mod ét immutabelt
// build-preview. Service workers er stadig som udgangspunkt blokeret i browserkonteksten nedenfor.
const webServerCommand = 'npm run generate:build-info && npx vite build --config vite.mineo.config.ts --mode e2e && node scripts/verify-build-artifacts.mjs mineo dist/mineo --allow-automation-bridge && npx vite build --config vite.minprocesrente.config.ts --base /minprocesrente/ && node scripts/ensure-build-index.mjs dist/minprocesrente minprocesrente.html && node scripts/cleanup-minprocesrente-public.mjs dist/minprocesrente && node scripts/verify-build-artifacts.mjs minprocesrente dist/minprocesrente && node scripts/serve-e2e-builds.mjs --port 4173';

export default defineConfig({
  testDir: './e2e',
  // **Lofterne er sat ned fra 120 s/30 s.** Et loft er ikke gratis, selv om ingen test venter på det:
  // det er den tid, en HÆNGENDE test koster, før kørslen kan fortælle hvad der gik galt. Suitens
  // langsomste ægte test måler under seks sekunder — inklusive app-boot og skærmprint — så 60 s er ti
  // gange hovedrum, og en test, der bruger dem, hænger. Det var netop den regning, der gjorde suiten
  // uoverkommelig: ét fastlåst flow åd flere minutter pr. kørsel uden at sige noget.
  //
  // De høje lofter blev sat, fordi Vites dev-server kunne bruge over 30 sekunder på første transform
  // af Mineos modultræ. Suiten kører ikke længere mod dev-serveren, men mod ét færdigbygget preview,
  // hvor den udgift ikke findes.
  //
  // Lofterne skaleres fortsat med maskinprofilen (op til ×3), så en svagere maskine ikke rapporterer
  // sin egen langsomhed som et browserfund.
  timeout: scaleTimeout(60_000),
  expect: { timeout: scaleTimeout(15_000) },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Ingen lokale retries: en flaky test skal ses som flaky, ikke skjules af et genforsøg. Det er
  // parallelitetsloftet — ikke retries — der holder en svagere maskine fri af ressourcecrashes.
  workers: process.env.CI ? 1 : machineProfile.workers,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Ingen videooptagelse. `retain-on-failure` lyder billigt, men optager i praksis ALLE tests og
    // kasserer bagefter dem der bestod — en fast CPU- og hukommelsesudgift pr. test, som på den
    // svagere bærbar er med til at fremkalde netop de timeouts, den skulle hjælpe med at forklare.
    // Tracen dækker samme behov bedre: den gemmer handlinger, DOM-snapshots og konsol for den
    // test, der faktisk fejlede. Sæt `PLAYWRIGHT_VIDEO=1`, når en fejl kun kan ses som bevægelse.
    video: process.env.PLAYWRIGHT_VIDEO === '1' ? 'retain-on-failure' : 'off',
    // Den normale E2E-suite skal være cachefri: en cachet forgænger må aldrig kunne besvare den næste
    // tests requests. Et spec, der HAR brug for service workers, åbner selv for dem i sit eget omfang
    // med `test.use({ serviceWorkers: 'allow' })` — se `e2e/pwa-service-worker.spec.ts`. Variablen
    // nedenfor åbner for hele kørslen på én gang og er til den brede PWA-audit mod et preview
    // (`.agents/skills/jette-interaktionsaudit`), ikke til enkelte specs: da den var den ENESTE vej,
    // blev PWA-specs' tests i praksis aldrig kørt.
    serviceWorkers: allowServiceWorkers ? 'allow' : 'block',
  },
  projects,
  webServer: useExternalWebServer
    ? undefined
    : {
      // Begge app-varianter bygges først og serveres derefter fra hver sin immutable rod. Den
      // almindelige suite blokerer service workers, mens PWA-scenarierne eksplicit tillader dem.
      command: webServerCommand,
      url: baseURL,
      // Audit- og E2E-resultater må komme fra den build/server, som testen selv starter.
      // En eksisterende proces må kun genbruges eksplicit, ellers kan en gammel server skjule
      // ændringer eller servere et andet commit end det, testen dokumenterer.
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1',
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: scaleTimeout(120_000),
    },
});

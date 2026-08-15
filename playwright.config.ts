import { defineConfig, devices } from '@playwright/test';
import { reportMachineProfile, resolveMachineProfile } from './e2e/support/machineProfile';

const defaultBaseURL = 'http://127.0.0.1:4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
const useExternalWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const allowServiceWorkers = process.env.PLAYWRIGHT_ALLOW_SERVICE_WORKERS === '1';
// 1536×864 CSS-pixels svarer til en fysisk 1920×1080-skærm ved 125 % Windows-visningsskalering
// og browserzoom 100 %. Full HD køres som en særskilt kontrastviewport, ikke som minimum.
const minimumDesktopViewport = { width: 1536, height: 864 } as const;
const fullHdDesktopViewport = { width: 1920, height: 1080 } as const;
const largerDesktopViewport = { width: 2560, height: 1440 } as const;

const minimumDesktopProjects = [
  {
    name: 'chrome-desktop',
    use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: minimumDesktopViewport },
  },
  {
    name: 'edge-desktop',
    use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: minimumDesktopViewport },
  },
  {
    name: 'firefox-desktop',
    use: { ...devices['Desktop Firefox'], viewport: minimumDesktopViewport },
  },
  {
    name: 'safari-webkit-desktop',
    use: { ...devices['Desktop Safari'], viewport: minimumDesktopViewport },
  },
];

const fullHdDesktopProjects = [
  {
    name: 'chrome-desktop-full-hd',
    use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: fullHdDesktopViewport },
  },
  {
    name: 'edge-desktop-full-hd',
    use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: fullHdDesktopViewport },
  },
  {
    name: 'firefox-desktop-full-hd',
    use: { ...devices['Desktop Firefox'], viewport: fullHdDesktopViewport },
  },
  {
    name: 'safari-webkit-desktop-full-hd',
    use: { ...devices['Desktop Safari'], viewport: fullHdDesktopViewport },
  },
];

const desktopProjects = [...minimumDesktopProjects, ...fullHdDesktopProjects];

const projects = [
  ...desktopProjects,
  ...(process.env.PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT === '1'
    ? desktopProjects.map((project) => ({
      name: `${project.name}-large`,
      use: { ...project.use, viewport: largerDesktopViewport },
    }))
    : []),
];

// Suiten køres både på en kraftig stationær maskine, i CI og på en svagere bærbar. Profilen måler
// maskinens kerner, hukommelse og faktiske hastighed og skruer parallelitet og timeout-lofter
// derefter. På referencemaskinen og i CI giver den præcis de værdier, konfigurationen havde før.
const machineProfile = resolveMachineProfile();
reportMachineProfile(machineProfile);

const scaleTimeout = (baseMs: number): number => Math.round(baseMs * machineProfile.timeoutScale);

const webServerCommand = allowServiceWorkers
  ? 'npm run build:mineo && npx vite preview --config vite.mineo.config.ts --host 127.0.0.1 --port 4173'
  : 'npm run dev:e2e -- --port 4173';

export default defineConfig({
  testDir: './e2e',
  // Mineos store modultræ kan bruge over 30 sekunder på første Vite-transform på Windows,
  // især i Firefox/WebKit. Den høje loftstid gælder hele flowet; elementforventninger får et
  // separat loft, så en langsom lazy-load ikke registreres som et falsk browserfund.
  //
  // Lofterne skaleres med maskinprofilen. Ingen test venter på sin timeout, så et højere loft gør
  // ingen kørsel langsommere — det flytter alene skillelinjen mellem «maskinen er langsom» og
  // «flowet hænger», så en langsom maskine ikke rapporterer sig selv som et browserfund.
  timeout: scaleTimeout(120_000),
  expect: { timeout: scaleTimeout(30_000) },
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
    video: 'retain-on-failure',
    // Dev-E2E skal være cachefri. PWA-scenarier opt-in'er eksplicit mod et produktions-preview.
    serviceWorkers: allowServiceWorkers ? 'allow' : 'block',
  },
  projects,
  webServer: useExternalWebServer
    ? undefined
    : {
      // Den ægte PWA-suite skal ramme de emitterede sw.js/pwa-assets.json-artefakter. Den almindelige
      // suite bruger fortsat Vite-devserveren og blokerede service workers for at være cachefri.
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

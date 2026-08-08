import { defineConfig, devices } from '@playwright/test';

const defaultBaseURL = 'http://127.0.0.1:4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
const useExternalWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const allowServiceWorkers = process.env.PLAYWRIGHT_ALLOW_SERVICE_WORKERS === '1';
const minimumDesktopViewport = { width: 1920, height: 1080 } as const;
const largerDesktopViewport = { width: 2560, height: 1440 } as const;

const desktopProjects = [
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

const projects = [
  ...desktopProjects,
  ...(process.env.PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT === '1'
    ? desktopProjects.map((project) => ({
      name: `${project.name}-large`,
      use: { ...project.use, viewport: largerDesktopViewport },
    }))
    : []),
];

export default defineConfig({
  testDir: './e2e',
  // Mineos store modultræ kan bruge over 30 sekunder på første Vite-transform på Windows,
  // især i Firefox/WebKit. Den høje loftstid gælder hele flowet; elementforventninger får et
  // separat loft, så en langsom lazy-load ikke registreres som et falsk browserfund.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
      command: 'npm run dev:e2e -- --port 4173',
      url: baseURL,
      // Audit- og E2E-resultater må komme fra den build/server, som testen selv starter.
      // En eksisterende proces må kun genbruges eksplicit, ellers kan en gammel server skjule
      // ændringer eller servere et andet commit end det, testen dokumenterer.
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1',
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 120_000,
    },
});

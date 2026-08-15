import { expect, type Locator, type Page, test as base } from '@playwright/test';

// Delt e2e-grundlag. Findes fordi de 20 spec-filer hver især gentog det samme opstartsarbejde: 19 kopier af
// testpasswordet, 38 linjers håndskrevet login og en runtime-signalopsamling, der kun var med i nogle af dem.
// Duplikeringen betød i praksis, at et nyt spec kunne mangle netop den kontrol, der ville have fanget en fejl.

/**
 * Browser-agentens dedikerede testpassword (dokumenteret i AGENTS.md, hash-verificeret i
 * `authConfig.ts`). ÉT sted, så et skift ikke kræver 19 rettelser.
 */
export const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

/** Nøglen, DEV-broen installerer sig under. Holdt i sync med `automationIntrospectionBridge.ts`. */
const AUTOMATION_BRIDGE_KEY = '__mineoAutomation';

export type AutomationFieldState = Readonly<{
  address: string;
  fieldId: string;
  label: string;
  rejected: boolean;
  issue: Readonly<{ code: string; reason: string; message: string }>;
}>;

export type AutomationSnapshot = Readonly<{
  revision: number;
  fields: readonly AutomationFieldState[];
  rejectedAddresses: readonly string[];
}>;

/** Logger ind gennem den synlige formular — samme vej som brugeren, aldrig gennem en state-genvej. */
export const login = async (page: Page, path = '/'): Promise<void> => {
  await page.goto(path);
  const password = page.getByLabel('Adgangskode');
  await expect(password).toBeVisible();
  await password.fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const BRIDGE_MISSING_MESSAGE =
  'Automatiseringsbroen blev aldrig installeret. Den findes kun i DEV/test — kører testen mod et produktionsbuild?';

const evaluateBridgeSnapshot = async (page: Page): Promise<unknown> => page.evaluate((key) => {
  const api = (window as unknown as Record<string, { readSnapshot: () => unknown } | undefined>)[key];
  return api === undefined ? null : api.readSnapshot();
}, AUTOMATION_BRIDGE_KEY);

/**
 * Læser den maskinlæsbare issue-/rejected-tilstand fra DEV-broen.
 *
 * Bruges frem for at aflæse en rød kant: farven kan ikke skelne rejected råtekst fra en canonical
 * bounds-fejl, og netop den skelnen afgør, om `.eo`-save blokerer (§1.6).
 *
 * Aflæsningen venter på, at broen findes. Den installeres i en effect i app-shellen, og shellen ligger
 * bag en lazy chunk: URL-skiftet efter login sker FØR broen er der. En enkelt aflæsning er derfor et
 * kapløb, som kun den hurtigste browser vinder — og en `waitForTimeout` ville bytte kapløbet ud med et
 * gæt. Findes broen aldrig, fejler ventetiden med den samme forklaring som før.
 */
export const readAutomationSnapshot = async (page: Page): Promise<AutomationSnapshot> => {
  await expect
    .poll(async () => (await evaluateBridgeSnapshot(page)) !== null, { message: BRIDGE_MISSING_MESSAGE })
    .toBe(true);

  const snapshot = await evaluateBridgeSnapshot(page);
  if (snapshot === null) {
    throw new Error(BRIDGE_MISSING_MESSAGE);
  }
  return snapshot as AutomationSnapshot;
};

/**
 * Venter på, at afsluttet input faktisk har ændret sig, i stedet for at sove et gæt på antal millisekunder.
 * En fast `waitForTimeout` er den hyppigste kilde til flaksende tests: den er både for lang i det normale
 * tilfælde og for kort på en belastet maskine.
 */
export const waitForSettledChange = async (page: Page, previousRevision: number): Promise<number> => {
  await expect
    .poll(async () => (await readAutomationSnapshot(page)).revision)
    .not.toBe(previousRevision);
  return (await readAutomationSnapshot(page)).revision;
};

/**
 * Skriv en værdi i et felt gennem dets almindelige totrins fokus-/redigeringsmodel.
 *
 * Findes som ÉT sted, fordi mønsteret `dblclick()` → `fill()` var gentaget 19 gange i ni spec-filer, og
 * hver kopi bar den samme tidsafhængighed: dobbeltklikket åbner redigeringstilstanden, men kun hvis
 * feltet allerede er interaktivt, OG kun hvis browserens to klik falder inden for dens dobbeltklik-
 * interval. På en langsom, hukommelsespresset maskine kan begge dele glippe. `fill()` rammer så et felt,
 * der ikke redigerer, og testen bruger hele sit timeout-loft på et klik uden virkning — uden at
 * produktet fejler.
 *
 * Helperen venter på interaktivitet og bekræfter, at værdien faktisk landede; ramte dobbeltklikket
 * ikke, åbnes redigeringstilstanden igen frem for at antage det modsatte. `toPass` gør genforsøget til
 * en betingelse på den observerede tilstand, ikke en fast ventetid.
 */
export const setFieldValue = async (input: Locator, value: string): Promise<void> => {
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();

  await expect(async () => {
    await input.dblclick();
    await input.fill(value);
    await expect(input).toHaveValue(value, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
};

/**
 * Som `setFieldValue`, men afslutter indtastningen med Tab, så feltet settler.
 *
 * Her hævdes værdien BEVIDST ikke igen bagefter. Settle er netop det tidspunkt, hvor feltet må
 * normalisere sin visning: et beløbsfelt viser `300.000` for den indtastede `300000`, en brøk
 * reducerer `02/04` til `2/4`. En efterkontrol på den RÅ streng ville derfor være falsk for hele
 * beløbs- og brøkfamilien. Kontrollen af, at indtastningen landede, hører hjemme i `setFieldValue`,
 * hvor feltet stadig viser den rå tekst — og den er allerede sket, når vi når hertil. Skal en test
 * hævde den formaterede visning, gør den det eksplicit på sit eget sted, hvor den rigtige forventede
 * tekst er kendt.
 */
export const setFieldValueAndSettle = async (input: Locator, value: string): Promise<void> => {
  await setFieldValue(input, value);
  await input.press('Tab');
};

/**
 * Som `setFieldValueAndSettle`, men for felter hvor settle IKKE omformaterer visningen — datoer og fri
 * tekst. Her er den settlede visning lig den indtastede streng, og efterkontrollen er derfor både
 * gyldig og værdifuld: den fanger et felt, der tavst kasserede eller normaliserede indtastningen.
 * Brug den IKKE til beløb eller brøker (`300000` → `300.000`, `02/04` → `2/4`).
 */
export const setVerbatimFieldValueAndSettle = async (
  input: Locator,
  value: string,
): Promise<void> => {
  await setFieldValueAndSettle(input, value);
  await expect(input).toHaveValue(value);
};

/**
 * Test-fixture med runtime-orakler slået til fra FØR første navigation.
 *
 * `runtimeSignals` og `externalRequests` opsamles altid; et spec, der ikke hævder på dem, mister dermed
 * ikke opsamlingen — den er der, når fejlen skal forklares.
 */
export const test = base.extend<{
  runtimeSignals: string[];
  externalRequests: string[];
}>({
  // Fixture-argumentet hedder bevidst `provide` og ikke Playwrights sædvanlige `use`: ESLints
  // `react-hooks/rules-of-hooks` læser et bart `use(...)` som React 19's `use`-hook og fejler på det.
  // Navnet er positionelt i Playwright, så omdøbningen er uden betydning for fixturen.
  runtimeSignals: async ({ page }, provide) => {
    const signals: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        signals.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => signals.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) => {
      signals.push(
        `requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'ukendt'})`,
      );
    });
    await provide(signals);
  },
  externalRequests: async ({ page }, provide) => {
    const allowedOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173').origin;
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && url.origin !== allowedOrigin) {
        external.push(request.url());
      }
    });
    await provide(external);
  },
});

export { expect };

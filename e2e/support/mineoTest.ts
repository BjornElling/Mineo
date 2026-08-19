import { expect, type Locator, type Page, test as base } from '@playwright/test';

// Delt e2e-grundlag – det ENE sted, et spec henter `test`, `expect` og sine helpers fra.
//
// Findes fordi hver spec-fil gentog det samme opstartsarbejde: sin egen kopi af testpasswordet, sit eget
// login, sin egen runtime-signalopsamling og sin egen (som regel manglende) ventetid efter en navigation.
// Duplikeringen betød i praksis, at et nyt spec kunne mangle netop den kontrol, der ville have fanget en
// fejl – og at en rettelse af én tidsafhængighed kun ramte den ene kopi. Konvergensen er håndhævet af
// `src/__tests__/quality/e2eSuiteConventions.test.ts`.

/**
 * Browser-agentens dedikerede testpassword (dokumenteret i AGENTS.md, hash-verificeret i
 * `authConfig.ts`). ÉT sted, så et skift ikke kræver en rettelse pr. spec-fil.
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

/**
 * Logger ind gennem den synlige formular – samme vej som brugeren, aldrig gennem en state-genvej.
 *
 * Ventepunktet er sidemenuen, ikke URL'en: URL'en skifter i samme øjeblik, gaten åbner, mens
 * app-shellen er en lazy chunk, der først males bagefter. Uden ventepunktet begynder testens første
 * handling derfor mod en tom side, og en langsom maskine får et timeout uden årsag.
 */
export const login = async (page: Page, path = '/'): Promise<void> => {
  await page.goto(path);
  const password = page.getByLabel('Adgangskode');
  await expect(password).toBeVisible();
  await password.fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
  await expect(page.getByRole('button', { name: 'Om', exact: true })).toBeVisible();
};

/**
 * Sidemenuens navigationsmål: menuens etiket → den sidetitel, målet lander på.
 *
 * Etiketterne er sidemenuens (`src/components/layout/sideMenuItems.tsx`), titlerne er sidernes egne
 * `.page-title`. De to er BEVIDST forskellige to steder – «Om» viser «Mineo», og «Satser» viser
 * «Arbejdsskadesatser <år>» – og netop dét er grunden til, at kortet står her frem for at blive gættet
 * på kaldsstedet.
 */
const MINEO_PAGE_TITLES = {
  Stamdata: /^Stamdata$/,
  Erstatningsopgørelse: /^Erstatningsopgørelse$/,
  Erhvervsevnetab: /^Erhvervsevnetab$/,
  'Varige mén': /^Varige mén$/,
  Forsørgertab: /^Forsørgertab$/,
  Årslønsberegning: /^Årslønsberegning$/,
  Renteberegning: /^Renteberegning$/,
  Satser: /^Arbejdsskadesatser\b/,
  Indstillinger: /^Indstillinger$/,
  Om: /^Mineo$/,
} as const;

export type MineoPageName = keyof typeof MINEO_PAGE_TITLES;

/**
 * Naviger til en side gennem sidemenuen – og vent på, at siden FAKTISK er der.
 *
 * **Hvorfor helperen findes.** Et bart `getByRole('button', { name: 'Erstatningsopgørelse' }).click()`
 * skifter kun URL'en. Sidekomponenterne er lazy chunks, så den FORRIGE side bliver stående, indtil
 * chunken er hentet og monteret. Ventes der ikke, måler den næste påstand den forrige side – og fordi
 * de fleste påstande er generiske (`.content-box`, en knap, en dialog), er den forrige side som regel
 * et gyldigt svar. Testen bliver dermed grøn på det forkerte grundlag, når maskinen er hurtig, og rød
 * uden forklaring, når den er langsom.
 *
 * Det var ikke en teoretisk fælde: `content-scale.spec.ts` › «skærmprint …» klikkede sig til
 * Erstatningsopgørelse, fandt rapportknappen på den STADIG viste Indstillinger-side, åbnede DENS dialog
 * – og så forsvandt dialogen, da EO-chunken landede og Indstillinger blev unmountet. Testen brugte
 * derefter hele sit timeout-loft på at vente på en knap i en dialog, der aldrig kom igen. Med otte
 * samtidige workers ramte den hver gang; alene var den grøn på 2,4 s.
 *
 * Ventepunktet er sidens egen `.page-title`, fordi den er det første, den nye side maler – og fordi
 * URL'en skifter FØR monteringen og derfor ikke kan bruges som signal.
 */
export const openPage = async (page: Page, name: MineoPageName): Promise<void> => {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.page-title')).toHaveText(MINEO_PAGE_TITLES[name]);
};

const BRIDGE_MISSING_MESSAGE =
  'Automatiseringsbroen blev aldrig installeret. Den findes kun i DEV/test – kører testen mod et produktionsbuild?';

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
 * kapløb, som kun den hurtigste browser vinder – og en `waitForTimeout` ville bytte kapløbet ud med et
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
 * der ikke redigerer, og testen bruger hele sit timeout-loft på et klik uden virkning – uden at
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
 * hvor feltet stadig viser den rå tekst – og den er allerede sket, når vi når hertil. Skal en test
 * hævde den formaterede visning, gør den det eksplicit på sit eget sted, hvor den rigtige forventede
 * tekst er kendt.
 */
export const setFieldValueAndSettle = async (input: Locator, value: string): Promise<void> => {
  await setFieldValue(input, value);
  await input.press('Tab');
};

/**
 * Som `setFieldValueAndSettle`, men for felter hvor settle IKKE omformaterer visningen – datoer og fri
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
 * ikke opsamlingen – den er der, når fejlen skal forklares.
 */
export const test = base.extend<{
  runtimeSignals: string[];
  runtimeErrors: string[];
  externalRequests: string[];
}>({
  // Fixture-argumentet hedder bevidst `provide` og ikke Playwrights sædvanlige `use`: ESLints
  // `react-hooks/rules-of-hooks` læser et bart `use(...)` som React 19's `use`-hook og fejler på det.
  // Navnet er positionelt i Playwright, så omdøbningen er uden betydning for fixturen.
  runtimeSignals: async ({ page }, provide) => {
    const signals: string[] = [];
    page.on('console', (message) => {
      // WebKit udsteder selv denne timingdiagnose for gyldige modulepreloads, når en lazy route
      // bruger assetet senere end få sekunder efter window.load. Det er hverken applikationskode,
      // en runtimefejl eller en fejlet request, og må ikke gøre en stabil brugerrejse flaky.
      const isWebKitPreloadTimingWarning = message.type() === 'warning'
        && /^The resource .+ was preloaded using link preload but not used within a few seconds /.test(message.text());
      if (isWebKitPreloadTimingWarning) return;
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
  /**
   * Kun de HÅRDE runtimesignaler: konsolfejl og ubehandlede undtagelser.
   *
   * Findes ved siden af `runtimeSignals`, fordi ti spec-filer havde hver sin håndskrevne kopi af
   * præcis denne opsamling – og fordi de to påstande ikke er den samme: `runtimeSignals` tæller også
   * advarsler og fejlede requests og bruges, hvor en test vil hævde, at INTET blev sagt.
   * `runtimeErrors` bruges, hvor den almindelige brugerrejse ikke må fejle, men godt må advare.
   */
  runtimeErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await provide(errors);
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

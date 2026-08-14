import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Betingede bilagsvalg vises ALTID — inaktive og umarkerede med årsagen i tooltippet
 * (`page-component-contract.md` §10.5).
 *
 * Testen findes, fordi de to bilagsvalg på Differencekrav-fanen tidligere blev SKJULT, når bilaget ikke
 * fandtes i beregningen. Et valg, der forsvinder, efterlader brugeren i tvivl om, hvorvidt muligheden
 * findes i programmet — og en unit-test kan ikke se det: den kan hævde resolverens tekst, men ikke at
 * feltet faktisk står på skærmen med den tekst i et tooltip, brugeren kan hovere frem.
 *
 * Den dækker samtidig rangordenen (§10.5, punkt 4): brugerens eget fravalg forklares FØR beregningsårsagen.
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const FRAVALGT_DELTEKST = 'fravalgt nedenfor';
const INGEN_FORHOEJELSE_DELTEKST = 'ikke forhøjet i perioden';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const setDate = async (input: Locator, value: string): Promise<void> => {
  await input.dblclick();
  await input.fill(value);
  await input.press('Tab');
  await expect(input).toHaveValue(value);
};

const setText = async (input: Locator, value: string): Promise<void> => {
  await input.dblclick();
  await input.fill(value);
  await input.press('Tab');
};

/**
 * Fylder det mindste EET-forløb, der får Differencekrav-fanens "Beregning"-boks (og dermed bilagsvalgene)
 * frem: fødselsdato + skadedato på Stamdata, og beregningsdato + årsløn + én ASL-afgørelse på EET.
 * Uden alle fem blokerer fanen og viser i stedet fallback-boksen uden bilagsvalg.
 */
const fyldMindsteEetSag = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Stamdata' }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1970');
  await setDate(page.locator("input[name='skadedato']"), '01-01-2010');

  await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
  await page.getByRole('tab', { name: 'EET oplysninger' }).click();

  await setDate(page.locator("input[name='beregningsdato']"), '01-01-2025');
  await setText(page.getByRole('textbox', { name: 'Årsløn', exact: true }), '400000');

  // Én ASL-afgørelse. Alle fire dele skal med: uden afgørelsestype melder fanen "Der er en afgørelse
  // uden afgørelsestype" og blokerer stadig, så bilagsvalgene aldrig ville nå at blive rendret.
  await setDate(page.getByRole('textbox', { name: 'Afgørelsesdato' }).first(), '01-06-2012');
  await setDate(page.getByRole('textbox', { name: 'Virkningsdato' }).first(), '01-06-2012');
  await setText(page.getByRole('textbox', { name: 'EET %' }).first(), '50');

  const afgoerelsestype = page.getByRole('combobox', { name: 'Afgørelsestype' }).first();
  await afgoerelsestype.click();
  await page.getByRole('option', { name: 'Endelig', exact: true }).click();
  await expect(afgoerelsestype).toHaveValue('Endelig');
};

test.describe('Bilagsvalg — inaktivt med årsag frem for skjult', () => {
  test('Mer-erstatning-bilaget bliver stående med årsag, når der ikke er nogen forhøjelse', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await fyldMindsteEetSag(page);

    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    const bilag = page.getByRole('checkbox', { name: 'Mer-erstatning forhøjet folkepension' });

    // Kernen: valget er SYNLIGT, men inaktivt og umarkeret — ikke væk.
    await expect(bilag).toBeVisible();
    await expect(bilag).toBeDisabled();
    await expect(bilag).not.toBeChecked();

    // Årsagen har kun én visningskanal: tooltippet ved hover. Den må ikke stå som tekst i fladen.
    await expect(page.getByText(INGEN_FORHOEJELSE_DELTEKST)).toHaveCount(0);
    await page.getByText('Mer-erstatning forhøjet folkepension').hover();
    await expect(page.getByRole('tooltip')).toContainText(INGEN_FORHOEJELSE_DELTEKST);

    expect(runtimeErrors).toEqual([]);
  });

  test('Brugerens eget fravalg forklares før beregningsårsagen', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await fyldMindsteEetSag(page);

    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    // Fravælg mer-erstatningen i "Valgmuligheder" nedenfor.
    await page.getByRole('checkbox', { name: 'Indregn mer-erstatning ved forhøjet pensionsalder' }).click();

    const bilag = page.getByRole('checkbox', { name: 'Mer-erstatning forhøjet folkepension' });
    await expect(bilag).toBeVisible();
    await expect(bilag).toBeDisabled();

    await page.getByText('Mer-erstatning forhøjet folkepension').hover();
    const tooltip = page.getByRole('tooltip');

    // Rangordenen: fravalget nævnes, og beregningsårsagen holdes tilbage. Ellers ville brugeren få at
    // vide, at pensionsalderen ikke er forhøjet — uden at programmet har efterprøvet det.
    await expect(tooltip).toContainText(FRAVALGT_DELTEKST);
    await expect(tooltip).not.toContainText(INGEN_FORHOEJELSE_DELTEKST);

    expect(runtimeErrors).toEqual([]);
  });
});

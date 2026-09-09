import { type Page } from '@playwright/test';

import { expect, login, openPage, setFieldValueAndSettle, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

/**
 * Betingede bilagsvalg vises ALTID – inaktive og umarkerede med årsagen i tooltippet
 * (`page-component-contract.md` §10.5).
 *
 * Testen findes, fordi de to bilagsvalg på Differencekrav-fanen tidligere blev SKJULT, når bilaget ikke
 * fandtes i beregningen. Et valg, der forsvinder, efterlader brugeren i tvivl om, hvorvidt muligheden
 * findes i programmet – og en unit-test kan ikke se det: den kan hævde resolverens tekst, men ikke at
 * feltet faktisk står på skærmen med den tekst i et tooltip, brugeren kan hovere frem.
 *
 * Den dækker samtidig rangordenen (§10.5, punkt 4): brugerens eget fravalg forklares FØR beregningsårsagen.
 */

const FRAVALGT_DELTEKST = 'fravalgt nedenfor';
const INGEN_FORHOEJELSE_DELTEKST = 'ikke forhøjet i perioden';
const INGEN_KAPITALISERING_DELTEKST = 'ingen kapitalisering at forhøje';
/** BB-191: ÉT navn for fradrag 4 – bilagsvalg, boks, specifikation, dokumentsektion og bilagstitel. */
const FORHOEJET_PENSIONSALDER = 'Forhøjet pensionsalder';
const MIDLERTIDIGT_EET_FRA_EET_SIDEN_TEKST = 'Indstillingen «Midlertidigt EET indsættes fra Erhvervsevnetab-siden» er slået fra på fanen «Offentlige ydelser»';

/** Datoindtastning gennem den delte, tidsrobuste totrins-helper (se `support/mineoTest.ts`). */
const setDate = setVerbatimFieldValueAndSettle;

/**
 * Tal-/tekstindtastning uden efterkontrol på den rå streng: felterne her er beløb og procenter, som
 * NORMALISERER deres visning ved settle (`400000` → `400.000`). Den oprindelige helper hævdede
 * bevidst heller ikke værdien bagefter.
 */
const setText = setFieldValueAndSettle;

/**
 * Fylder det mindste EET-forløb, der får Differencekrav-fanens "Beregning"-boks (og dermed bilagsvalgene)
 * frem: fødselsdato + skadedato på Stamdata, og beregningsdato + årsløn + én ASL-afgørelse på EET.
 * Uden alle fem blokerer fanen og viser i stedet fallback-boksen uden bilagsvalg.
 */
const fyldMindsteEetSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1970');
  await setDate(page.locator("input[name='skadedato']"), '01-01-2010');

  await openPage(page, 'Erhvervsevnetab');
  await page.getByRole('tab', { name: 'EET oplysninger' }).click();

  await setDate(page.locator("input[name='beregningsdato']"), '01-01-2025');
  await setText(page.getByRole('textbox', { name: 'Skadelidtes årsløn (efter ASL)', exact: true }), '400000');

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

/**
 * Hover-fladen for et inaktivt bilagsvalg. Tooltippet kan ikke ankres på kontrollen selv (et disabled
 * MUI-input udsender ingen pointer-events), så feltfamilien pakker den i `mineo-disabled-hover-target`.
 * Locatoren rammer derfor wrapperen og ikke etiketten, hvis ordlyd kan optræde flere steder på fladen.
 */
const bilagHoverFlade = (page: Page, label: string) =>
  page.locator('.mineo-disabled-hover-target').filter({ hasText: label }).first();

test.describe('Bilagsvalg – inaktivt med årsag frem for skjult', () => {
  test('Midlertidig EET forklares med indstillingens navn og fane', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Beregning' }).click();

    const bilag = page.getByRole('checkbox', { name: 'Midlertidig EET' });
    await expect(bilag).toBeVisible();
    await expect(bilag).toBeDisabled();

    await page.getByText('Midlertidig EET', { exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveText(MIDLERTIDIGT_EET_FRA_EET_SIDEN_TEKST);

    expect(runtimeErrors).toEqual([]);
  });

  /**
   * Sagen har ingen kapitalisering, og DERFOR er der ingen mer-erstatning at beregne. Tooltippet
   * skrev tidligere «Pensionsalderen er ikke forhøjet i perioden», og det var direkte usandt netop
   * her: folkepensionsalderen blev forhøjet både 2015 og 2020, altså midt mellem sagens skadedato
   * (01-01-2010) og beregningsdato (01-01-2025), og programmet kender datoerne. Brugeren havde slået
   * beregningen TIL og fik et svar om lovgivningen frem for om sin sag (BB-189).
   */
  test('Mer-erstatning-bilaget bliver stående med årsag, når der ikke er nogen kapitalisering', async ({ page, runtimeErrors }) => {
    await login(page);
    await fyldMindsteEetSag(page);

    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    const bilag = page.getByRole('checkbox', { name: FORHOEJET_PENSIONSALDER, exact: true });

    // Kernen: valget er SYNLIGT, men inaktivt og umarkeret – ikke væk.
    await expect(bilag).toBeVisible();
    await expect(bilag).toBeDisabled();
    await expect(bilag).not.toBeChecked();

    // Årsagen har kun én visningskanal: tooltippet ved hover. Den må ikke stå som tekst i fladen.
    await expect(page.getByText(INGEN_KAPITALISERING_DELTEKST)).toHaveCount(0);
    await bilagHoverFlade(page, FORHOEJET_PENSIONSALDER).hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText(INGEN_KAPITALISERING_DELTEKST);
    // Den gamle, usande påstand om lovgivningen må ikke være tilbage i denne tilstand.
    await expect(tooltip).not.toContainText(INGEN_FORHOEJELSE_DELTEKST);

    expect(runtimeErrors).toEqual([]);
  });

  test('Brugerens eget fravalg forklares før beregningsårsagen', async ({ page, runtimeErrors }) => {
    await login(page);
    await fyldMindsteEetSag(page);

    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    // Fravælg mer-erstatningen i "Valgmuligheder" nedenfor.
    await page.getByRole('checkbox', { name: 'Indregn forhøjet pensionsalder', exact: true }).click();

    const bilag = page.getByRole('checkbox', { name: FORHOEJET_PENSIONSALDER, exact: true });
    await expect(bilag).toBeVisible();
    await expect(bilag).toBeDisabled();

    await bilagHoverFlade(page, FORHOEJET_PENSIONSALDER).hover();
    const tooltip = page.getByRole('tooltip');

    // Rangordenen: fravalget nævnes, og beregningsårsagerne holdes tilbage. Ellers ville brugeren få
    // at vide, at pensionsalderen ikke er forhøjet – uden at programmet har efterprøvet det.
    await expect(tooltip).toContainText(FRAVALGT_DELTEKST);
    await expect(tooltip).not.toContainText(INGEN_FORHOEJELSE_DELTEKST);
    await expect(tooltip).not.toContainText(INGEN_KAPITALISERING_DELTEKST);

    expect(runtimeErrors).toEqual([]);
  });

  /**
   * BB-188: «Kapitalisering» var altid aktivt og afkrydset, også i en sag helt uden kapitaliseringer,
   * hvor bilaget derefter udgik TAVST af papiret. Brugeren kunne ikke skelne «bilaget var tomt» fra
   * «noget faldt ud» – og netop den skelnen er det, gaten skal levere.
   */
  test('Kapitaliseringsbilaget gøres inaktivt med årsag i en sag uden kapitaliseringer', async ({ page, runtimeErrors }) => {
    await login(page);
    await fyldMindsteEetSag(page);

    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    const bilag = page.getByRole('checkbox', { name: 'Kapitalisering', exact: true });
    await expect(bilag).toBeVisible();
    await expect(bilag).toBeDisabled();
    await expect(bilag).not.toBeChecked();

    await bilagHoverFlade(page, 'Kapitalisering').hover();
    await expect(page.getByRole('tooltip')).toContainText('ingen kapitaliserede afgørelser i sagen');

    // «Opgørelse» er den modsatte tilstand: altid markeret, aldrig redigerbar.
    const opgoerelse = page.getByRole('checkbox', { name: 'Opgørelse', exact: true });
    await expect(opgoerelse).toBeChecked();
    await expect(opgoerelse).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
  });
});

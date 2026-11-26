import type { Page } from '@playwright/test';
import { expect, login, openPage, test } from './support/mineoTest';

/**
 * Firefox-fallback for Gem og Hent samt Løntrin-finderens datofelt.
 *
 * Adfærden kan kun måles i browseren: den handler om, hvad der sker i den rigtige
 * Firefox-runtime, hvor `showSaveFilePicker` mangler, og hvor filvælgeren kan levere både `change`
 * og `cancel` for samme dialogforløb.
 *
 * Testene følger brugerens trin så tæt, som en CLI-drevet browser kan, og asserterer, at
 * fejladfærden ikke opstår.
 */

const TECHNICAL_WARNING = 'Teknisk advarsel registreret';
const TECHNICAL_ERROR = 'Teknisk fejl registreret';

/**
 * `Journalnr.`-feltet har ingen tilgængeligt navn på selve inputtet; labelen står som et separat
 * afsnit ved siden af. Feltet lokaliseres derfor strukturelt ud fra sin label i stedet for med
 * `getByLabel`.
 */
const journalnrField = (page: Page) => page.locator('input[name="journalnr"]');

/**
 * Mineos inputfelter er `readOnly`, indtil et draft åbnes ved fokus (`TransientDateInput` m.fl.),
 * så `fill()` kan ikke bruges. Klik + tastatur er samtidig tættere på den manuelle browserrejse.
 */
const typeInto = async (page: Page, locator: ReturnType<typeof journalnrField>, value: string): Promise<void> => {
  await locator.click();
  await page.keyboard.type(value);
  await page.keyboard.press('Tab');
};

/**
 * Kører PRODUKTIONENS `Hent`-filvælger og fremtvinger den dobbeltlevering af `change` + `cancel`,
 * som Firefox' rigtige dialog kan give.
 *
 * Playwright kan ikke selv levere begge events, så `cancel` sendes manuelt på det `<input>`, som
 * appens eget `selectFile` netop har oprettet. Det er stadig produktionskoden, der rydder op –
 * testen efterligner kun browserens eventmønster, ikke oprydningen.
 */
const runDoubleCleanupOnRealPicker = async (page: Page): Promise<void> => {
  // Appen opretter inputtet ved klik. Vi fanger det, mens dialogen er åben.
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent' }).click();
  const chooser = await chooserPromise;

  // Referencen skal holdes FØR `change`: oprydningen fjerner elementet fra DOM'en, så en senere
  // `querySelector` ville ikke finde noget at sende `cancel` til – og testen ville bestå tomt.
  await page.evaluate(() => {
    (window as unknown as { __mineoAuditPicker?: Element | null }).__mineoAuditPicker =
      document.querySelector('input[type="file"]');
  });

  // `change` (via setFiles) efterfulgt af browserens andet callback, `cancel`, på samme element.
  await chooser.setFiles([]);
  await page.evaluate(() => {
    const held = (window as unknown as { __mineoAuditPicker?: Element | null }).__mineoAuditPicker;
    held?.dispatchEvent(new Event('cancel'));
  });
  await expect.poll(() => page.evaluate(
    () => document.querySelector('input[type="file"]') === null
  )).toBe(true);
};

/**
 * Bekræfter, at browseren under testen faktisk MANGLER File System Access API – altså at vi står i
 * fallback-grenen. Uden dette tjek kunne testen bestå, blot fordi fallbacken aldrig blev nået.
 */
const expectFallbackBranch = async (page: Page): Promise<void> => {
  const hasFsAccess = await page.evaluate(() => 'showSaveFilePicker' in window);
  expect(
    hasFsAccess,
    'Forudsætningen for OBS-005/OBS-028 er en browser UDEN File System Access API'
  ).toBe(false);
};

// Denne fil tildeles Firefox-projektet i playwright.config.ts og kører dér uden at skippe.
test.describe('Firefox-fallback og filvælger', () => {

  /**
   * Gem gennem fallback-download skal bruge sagens filnavn og gøre det klart, at den tidligere
   * fil ikke er overskrevet. Ellers vælger brugeren let den gamle fil næste gang og oplever datatab.
   */
  test('Gem via fallback-download peger på den nye fil', async ({ page, runtimeErrors, runtimeSignals }) => {
    await login(page);
    await expectFallbackBranch(page);

    await openPage(page, 'Stamdata');
    const journalnr = journalnrField(page);
    await typeInto(page, journalnr, 'SAVE1');

    // Fallback-grenen gemmer via et klassisk download-anker.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Mineo - SAVE1 - Erstatningsopgørelse.eo');
    await expect(page.getByText('Din browser kan ikke overskrive en eksisterende .eo-fil.', { exact: false })).toBeVisible();

    // Ingen synlig teknisk ramme ved en normal, lykket filhandling.
    await expect(page.getByText(TECHNICAL_WARNING, { exact: true })).toHaveCount(0);
    await expect(page.getByText(TECHNICAL_ERROR, { exact: true })).toHaveCount(0);

    expect(runtimeSignals).toEqual([]);
    expect(runtimeErrors).toEqual([]);

    // Værdien skal fortsat stå i feltet efter Gem.
    await expect(journalnr).toHaveValue('SAVE1');
  });

  /**
   * Hent gennem den synlige filvælger må ikke kaste `NotFoundError: Node.removeChild` i
   * filvælgerens oprydning, hvor Firefox kan levere både `change` og `cancel`.
   */
  test('Hent rydder filvælgeren op uden exception', async ({ page, runtimeErrors }) => {
    await login(page);
    await expectFallbackBranch(page);

    // Gem først en reel .eo, så Hent-flowet får en gyldig fil at vælge.
    await openPage(page, 'Stamdata');
    const journalnr = journalnrField(page);
    await typeInto(page, journalnr, 'ROUNDTRIP1');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem' }).click();
    const download = await downloadPromise;
    const savedPath = await download.path();
    expect(savedPath, 'Gem-fallbacken skal levere en faktisk midlertidig filsti').toEqual(expect.any(String));
    if (savedPath === null) {
      throw new Error('Gem-fallbacken leverede ingen filsti');
    }

    // Hent samme fil gennem den synlige filvælger – det trin, der ikke må kaste.
    //
    // `selectFile` opretter sit `<input type="file">` FØRST ved klik og fjerner det igen i
    // oprydningen. Filen skal derfor leveres gennem browserens filechooser-event, præcis som en
    // rigtig bruger gør det; en forudplaceret `setInputFiles` ville omgå netop det forløb.
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hent' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(savedPath as string);

    // Overskriv-dialogen bekræftes, hvis den vises.
    const overwrite = page.getByRole('button', { name: 'Overskriv' });
    if (await overwrite.isVisible().catch(() => false)) {
      await overwrite.click();
    }

    // Fejlsignalet: NotFoundError fra removeChild + synlig teknisk fejlramme.
    const removeChildErrors = runtimeErrors.filter(
      (message) => message.includes('removeChild') || message.includes('NotFoundError')
    );
    expect(removeChildErrors).toEqual([]);
    await expect(page.getByText(TECHNICAL_ERROR, { exact: true })).toHaveCount(0);
    await expect(page.getByText(TECHNICAL_WARNING, { exact: true })).toHaveCount(0);

    // Ovenstående alene er IKKE bevis. Playwrights `setFiles` leverer kun `change`, aldrig `cancel`,
    // så den DOBBELTE oprydning indtræffer ikke af sig selv i CLI. Kontrolleret nedenfor:
    // det er PRODUKTIONENS eget `selectFile`, der køres, og `cancel` fremtvinges oven på `change`
    // for at efterligne Firefox' dobbeltlevering. Et ubetinget `removeChild` ville
    // kaste `NotFoundError` ved andet kald; `settled`-værnet forhindrer det.
    await runDoubleCleanupOnRealPicker(page);

    const doubleCleanupErrors = runtimeErrors.filter(
      (message) => message.includes('removeChild') || message.includes('NotFoundError')
    );
    expect(doubleCleanupErrors).toEqual([]);
    await expect(page.getByText(TECHNICAL_ERROR, { exact: true })).toHaveCount(0);
  });

  /**
   * Løntrin-finderens datofelt må ikke blokeres af en synlig teknisk advarsel, der ligger
   * ovenpå og intercepter pointer events. Testen åbner overlayet og kræver, at datofeltet kan
   * klikkes og udfyldes uden først at skjule noget.
   */
  test('Løntrin-finderens datofelt kan klikkes uden at skjule en advarsel', async ({ page, runtimeErrors }) => {
    await login(page);
    await expectFallbackBranch(page);

    // Sessionen skal have en fallback-advarsel udløst af et Gem.
    await openPage(page, 'Stamdata');
    const journalnr = journalnrField(page);
    await typeInto(page, journalnr, 'LOENTRIN1');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem' }).click();
    await downloadPromise;

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: /Lønindkomst/ }).click();

    // `Find løntrin` findes kun i den OFFENTLIGE overenskomstgren. Opsætningen er
    // et ansættelsesforhold med overenskomst → KL-overenskomsten → `Overenskomst` som
    // beregningsgrundlag for lønudviklingen.
    const add = page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' });
    await expect(add).toBeVisible();
    await add.click();

    await page.locator('[name$=":harOverenskomst"]').check();

    await page.locator('[name$=":overenskomstFilter.arbejdsgiver"]').click();
    await page.getByRole('option', { name: 'KL', exact: true }).click();

    await page.locator('[name$=":overenskomstId"]').click();
    await page.getByRole('option', { name: /^KL-overenskomsten/ }).first().click();

    await page.locator('[name$=":loenudviklingBeregningsgrundlag"]').click();
    await page.getByRole('option', { name: 'Overenskomst', exact: true }).click();

    const finder = page.getByRole('button', { name: 'Find løntrin' });
    await expect(finder).toBeVisible();
    await finder.click();

    const dialog = page.getByRole('dialog', { name: 'Find løntrin' });
    await expect(dialog).toBeVisible();

    // Det er selve KLIKKET, en overliggende advarsel ville spærre (det ville time ud ved
    // intercepterede pointer events). Klikket får derfor et kort, eksplicit loft: lykkes det
    // inden for det, er interceptionen væk. Feltet udfyldes bagefter med tastatur, fordi Mineos
    // datofelter er `readOnly`, indtil klikket har åbnet deres draft.
    const dateField = dialog.getByPlaceholder('dd-mm-åååå').first();
    await expect(dateField).toBeVisible();
    await dateField.click({ timeout: 15_000 });
    await expect(dateField).toBeFocused();
    await page.keyboard.type('01-01-2020');
    await expect(dateField).toHaveValue('01-01-2020');

    // Advarslen må heller ikke være der i denne rejse.
    await expect(page.getByText(TECHNICAL_WARNING, { exact: true })).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });
});

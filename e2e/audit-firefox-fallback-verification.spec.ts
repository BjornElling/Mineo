import { expect, test, type Page } from '@playwright/test';

/**
 * EFTERKONTROL af tre browserfundne auditfund (OBS-005, OBS-028, CRASH-001).
 *
 * Alle tre blev fundet ved manuel Firefox-browseradfærd og kan derfor KUN lukkes af browseradfærd.
 * Kildelæsning er ikke tilstrækkeligt bevis: fundene handler netop om, hvad der sker i den rigtige
 * Firefox-runtime, hvor `showSaveFilePicker` mangler, og hvor filvælgeren kan levere både `change`
 * og `cancel` for samme dialogforløb.
 *
 * Testene reproducerer fundenes EGNE trin så tæt, som en CLI-drevet browser kan, og asserterer det,
 * fundene beskrev som fejladfærd. Består de, er fundet reelt lukket i den flade, det blev set i.
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const TECHNICAL_WARNING = 'Teknisk advarsel registreret';
const TECHNICAL_ERROR = 'Teknisk fejl registreret';

type ConsoleCapture = Readonly<{
  errors: string[];
  warnings: string[];
  pageErrors: string[];
}>;

const captureConsole = (page: Page): ConsoleCapture => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { errors, warnings, pageErrors };
};

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

/**
 * `Journalnr.`-feltet har ingen tilgængeligt navn på selve inputtet; labelen står som et separat
 * afsnit ved siden af. Feltet lokaliseres derfor strukturelt ud fra sin label i stedet for med
 * `getByLabel`. (At navnet mangler, er en selvstændig a11y-observation — ikke en del af disse fund.)
 */
const journalnrField = (page: Page) => page.locator('input[name="journalnr"]');

/**
 * Mineos inputfelter er `readOnly`, indtil et draft åbnes ved fokus (`TransientDateInput` m.fl.),
 * så `fill()` kan ikke bruges. Klik + tastatur er samtidig tættere på den manuelle browserrejse,
 * fundene stammer fra.
 */
const typeInto = async (page: Page, locator: ReturnType<typeof journalnrField>, value: string): Promise<void> => {
  await locator.click();
  await page.keyboard.type(value);
  await page.keyboard.press('Tab');
};

/**
 * Kører PRODUKTIONENS `Hent`-filvælger og fremtvinger den dobbeltlevering af `change` + `cancel`,
 * som Firefox' rigtige dialog kan give, og som CRASH-001 opstod i.
 *
 * Playwright kan ikke selv levere begge events, så `cancel` sendes manuelt på det `<input>`, som
 * appens eget `selectFile` netop har oprettet. Det er stadig produktionskoden, der rydder op —
 * testen efterligner kun browserens eventmønster, ikke oprydningen.
 */
const runDoubleCleanupOnRealPicker = async (page: Page): Promise<void> => {
  // Appen opretter inputtet ved klik. Vi fanger det, mens dialogen er åben.
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent' }).click();
  const chooser = await chooserPromise;

  // Referencen skal holdes FØR `change`: oprydningen fjerner elementet fra DOM'en, så en senere
  // `querySelector` ville ikke finde noget at sende `cancel` til — og testen ville bestå tomt.
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
  await page.waitForTimeout(500);
};

/**
 * Bekræfter, at browseren under testen faktisk MANGLER File System Access API — altså at vi står i
 * netop den fallback-gren, OBS-005 blev fundet i. Uden dette tjek kunne testen bestå, blot fordi
 * fallbacken aldrig blev nået, og så ville den ikke bevise noget om fundet.
 */
const expectFallbackBranch = async (page: Page): Promise<void> => {
  const hasFsAccess = await page.evaluate(() => 'showSaveFilePicker' in window);
  expect(
    hasFsAccess,
    'Forudsætningen for OBS-005/OBS-028 er en browser UDEN File System Access API'
  ).toBe(false);
};

test.describe('Efterkontrol: Firefox-fallback og filvælger (OBS-005, OBS-028, CRASH-001)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'firefox',
    'Alle tre fund blev observeret i Firefox-fallbacken'
  );

  /**
   * OBS-005: Gem gennem fallback-download må ikke fremstille en normal, forventet browserforskel
   * som en teknisk advarsel om en fejl i den underliggende kode.
   */
  test('OBS-005: normal Gem via fallback-download viser ingen teknisk advarsel', async ({ page }) => {
    const captured = captureConsole(page);
    await login(page);
    await expectFallbackBranch(page);

    await page.getByRole('button', { name: 'Stamdata' }).click();
    const journalnr = journalnrField(page);
    await typeInto(page, journalnr, 'SAVE1');

    // Fallback-grenen gemmer via et klassisk download-anker.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.eo$/);

    // Fundets kerne: den synlige tekniske ramme ved en normal, lykket filhandling.
    await expect(page.getByText(TECHNICAL_WARNING, { exact: true })).toHaveCount(0);
    await expect(page.getByText(TECHNICAL_ERROR, { exact: true })).toHaveCount(0);

    // Den udløsende console-advarsel fra fundet må heller ikke være der.
    expect(
      captured.warnings.filter((w) => w.includes('File System Access API ikke tilgængelig'))
    ).toEqual([]);
    expect(captured.errors).toEqual([]);
    expect(captured.pageErrors).toEqual([]);

    // Værdien skal fortsat stå i feltet efter Gem.
    await expect(journalnr).toHaveValue('SAVE1');
  });

  /**
   * CRASH-001: Hent gennem den synlige filvælger må ikke kaste `NotFoundError: Node.removeChild`
   * i filvælgerens oprydning. Fundet reproducerede 6/6 i Firefox.
   */
  test('CRASH-001: Hent rydder filvælgeren op uden exception', async ({ page }) => {
    const captured = captureConsole(page);
    await login(page);
    await expectFallbackBranch(page);

    // Gem først en reel .eo, så Hent-flowet får en gyldig fil at vælge — som i fundets starttilstand.
    await page.getByRole('button', { name: 'Stamdata' }).click();
    const journalnr = journalnrField(page);
    await typeInto(page, journalnr, 'ROUNDTRIP1');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem' }).click();
    const download = await downloadPromise;
    const savedPath = await download.path();
    expect(savedPath).toBeTruthy();

    // Hent samme fil gennem den synlige filvælger — det trin, der kastede.
    //
    // `selectFile` opretter sit `<input type="file">` FØRST ved klik og fjerner det igen i
    // oprydningen. Filen skal derfor leveres gennem browserens filechooser-event, præcis som en
    // rigtig bruger gør det; en forudplaceret `setInputFiles` ville omgå netop det forløb,
    // CRASH-001 handler om.
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hent' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(savedPath as string);

    // Overskriv-dialogen bekræftes, hvis den vises (som i fundets trin 4).
    const overwrite = page.getByRole('button', { name: 'Overskriv' });
    if (await overwrite.isVisible().catch(() => false)) {
      await overwrite.click();
    }

    // Fundets signal: NotFoundError fra removeChild + synlig teknisk fejlramme.
    const removeChildErrors = [...captured.errors, ...captured.pageErrors].filter(
      (message) => message.includes('removeChild') || message.includes('NotFoundError')
    );
    expect(removeChildErrors).toEqual([]);
    await expect(page.getByText(TECHNICAL_ERROR, { exact: true })).toHaveCount(0);
    await expect(page.getByText(TECHNICAL_WARNING, { exact: true })).toHaveCount(0);

    // Ovenstående alene er IKKE bevis. Playwrights `setFiles` leverer kun `change`, aldrig `cancel`,
    // så den DOBBELTE oprydning — fundets egentlige årsag — indtræffer ikke af sig selv i CLI.
    // (Netop derfor stod fundet med «real brugerfilvælger uafklaret».) Kontrolleret nedenfor:
    // det er PRODUKTIONENS eget `selectFile`, der køres, og `cancel` fremtvinges oven på `change`
    // for at efterligne Firefox' dobbeltlevering. Med det oprindelige ubetingede `removeChild`
    // kaster andet kald `NotFoundError`; med det nuværende `settled`-værn sker der intet.
    await runDoubleCleanupOnRealPicker(page);

    const doubleCleanupErrors = [...captured.errors, ...captured.pageErrors].filter(
      (message) => message.includes('removeChild') || message.includes('NotFoundError')
    );
    expect(doubleCleanupErrors).toEqual([]);
    await expect(page.getByText(TECHNICAL_ERROR, { exact: true })).toHaveCount(0);
  });

  /**
   * OBS-028: Løntrin-finderens datofelt blev blokeret, fordi den synlige tekniske advarsel lå
   * ovenpå og interceptede pointer events. Testen åbner overlayet og kræver, at datofeltet kan
   * klikkes og udfyldes uden først at skjule noget.
   */
  test('OBS-028: Løntrin-finderens datofelt kan klikkes uden at skjule en advarsel', async ({ page }) => {
    const captured = captureConsole(page);
    await login(page);
    await expectFallbackBranch(page);

    // Fundet forudsatte en session, hvor fallback-advarslen var udløst af et Gem.
    await page.getByRole('button', { name: 'Stamdata' }).click();
    const journalnr = journalnrField(page);
    await typeInto(page, journalnr, 'LOENTRIN1');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem' }).click();
    await downloadPromise;

    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    await page.getByRole('tab', { name: /Lønindkomst/ }).click();

    // `Find løntrin` findes kun i den OFFENTLIGE overenskomstgren. Opsætningen følger fundets
    // trin 2: et ansættelsesforhold med overenskomst → KL-overenskomsten → `Overenskomst` som
    // beregningsgrundlag for lønudviklingen.
    const add = page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' });
    await expect(add).toBeVisible();
    await add.click();
    await page.getByRole('button', { name: 'Ja, tilføj' }).click();

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

    // Kernen i fundet: selve KLIKKET timeoutede efter 30 s, fordi den synlige tekniske advarsel lå
    // ovenpå og interceptede pointer events. Klikket får derfor et kort, eksplicit loft: lykkes det
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

    expect(captured.pageErrors).toEqual([]);
  });
});

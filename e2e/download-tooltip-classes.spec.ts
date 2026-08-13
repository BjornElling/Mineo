import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Download-knappens tooltip: de tre brugerrettede klasser (brugerbeslutning 2026-08-13).
 *
 *  (a) Fejlen står i sidens fejl-/advarselsboks → «Opgørelse kan ikke hentes, når der er fejl ovenfor»
 *  (b) Et rødt felt blokerer                    → «Fejl i indtastning»
 *  (c) Et påkrævet felt er TOMT                 → «Indtastning mangler»
 *
 * Testen findes, fordi de tre tidligere kunne kollapse: en side kunne svare «Indtastning mangler» på et
 * felt, der var udfyldt med en ugyldig værdi, og Renteberegning viste gate-INTERNE strenge direkte. Kun en
 * browsertest ser den faktiske tooltip, brugeren læser — unit-testene hævder gate-klassen, ikke DOM'en.
 *
 * Den dækker samtidig, at dokumentaffordancen BLIVER stående på en blokeret revision: en skjult knap gør en
 * blokering tavs, og så har tooltippen intet at sidde på.
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const MISSING_INPUT = 'Indtastning mangler';
const INVALID_INPUT = 'Fejl i indtastning';
const PAGE_ERRORS = 'Opgørelse kan ikke hentes, når der er fejl ovenfor';
/** Codec-leveret konkret tekst for en velformet, men ikke-eksisterende kalenderdato. */
const NONEXISTENT_DAY = 'Datoen findes ikke i kalenderen';

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

/** Den deaktiverede downloadknaps tooltip er dens accessible name (jf. `DownloadIconButton`). */
const expectDisabledDownloadTooltip = async (button: Locator, tooltip: string): Promise<void> => {
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(tooltip);
};

test.describe('Download-tooltip — de tre klasser', () => {
  /**
   * Varige mén afhænger af Stamdatas fødselsdato og skadedato. Den skelnen brugeren efterspurgte — tom vs.
   * rød — afgøres af `varigeMenReaderProjection`s `require`-reads, og vises her fra brugerens side af skærmen.
   */
  test('Varige mén skelner tom indtastning fra rød feltfejl', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Varige mén' }).click();

    /**
     * Knappen findes på sin RÆKKE, ikke på sit navn: navnet ER tooltippen, og den er netop det, testen
     * måler. Et navnebaseret selektor ville gøre en forkert tekst til "element not found".
     */
    const download = page.getByTestId('varigemen-download');

    // (c) Alt er tomt → manglende indtastning.
    await expectDisabledDownloadTooltip(download, MISSING_INPUT);

    // (b) En ugyldig fødselsdato (31-02 findes ikke i kalenderen) → rød feltfejl.
    await page.getByRole('button', { name: 'Stamdata' }).click();
    const fodselsdato = page.locator("input[name='skadelidteFodselsdato']");
    await setDate(fodselsdato, '31-02-1980');
    await expect(fodselsdato).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Varige mén' }).click();
    /**
     * Her er blokeringen ÉT rødt felt, hvis codec leverer en konkret rettelsesvej — og så citeres den
     * ordret frem for klasseteksten (`specific`-allowlisten, `error-contract.md` §4).
     *
     * Det er en tilsigtet forbedring af den tidligere adfærd: gaten testede før `bounds || rule` i hånden
     * og sendte derfor ALLE `format`-fejl i den generiske gren, også dem hvor codec'en HAVDE noget konkret
     * at sige. Klassifikationen genbruger nu `resolveFieldIssueTooltip`, så knappen og feltet siger det
     * samme.
     */
    await expectDisabledDownloadTooltip(download, NONEXISTENT_DAY);

    /**
     * TO uafhængige røde felter → klasseteksten, ikke et citat. Det er lempelsens kerne: med to fejl ville
     * et citat af den ene udpege den som "fejlen" og skjule den anden. Felterne bærer selv deres beskeder.
     *
     * Méngrad bruges som andet felt frem for endnu en dato: `runProjection` dedupper issues på `kind:code`,
     * så to datofelter med samme fejlkode kollapser til ÉN post og ville forblive et lovligt enkeltcitat.
     */
    const mengrad = page.locator("input[name='mengrad']");
    await mengrad.dblclick();
    await mengrad.fill('999');
    await mengrad.press('Tab');
    await expect(mengrad).toHaveAttribute('aria-invalid', 'true');
    await expectDisabledDownloadTooltip(download, INVALID_INPUT);

    // Rettes méngraden, er der igen kun ÉN rød fejl at citere.
    await mengrad.dblclick();
    await mengrad.fill('10');
    await mengrad.press('Tab');
    await expect(mengrad).not.toHaveAttribute('aria-invalid', 'true');
    await expectDisabledDownloadTooltip(download, NONEXISTENT_DAY);

    // Rettes datoen, falder gaten tilbage til de øvrige tomme felter — ikke til en stale rød tilstand.
    await page.getByRole('button', { name: 'Stamdata' }).click();
    await setDate(fodselsdato, '01-01-1980');
    await expect(fodselsdato).not.toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Varige mén' }).click();
    await expectDisabledDownloadTooltip(download, MISSING_INPUT);

    expect(runtimeErrors).toEqual([]);
  });

  /**
   * (a) Erstatningsopgørelsens fire knapper. Teksten kom før fra en hardkodet ternary i `EOberegningTab`,
   * som kastede gatens svar væk; nu er den gatens klasse `page-errors`. Brugeren skal se samme tekst som før.
   */
  test('Erstatningsopgørelse henviser til sin egen fejlboks', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    await page.getByRole('tab', { name: 'Beregning' }).click();

    const fejlboks = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(fejlboks).toBeVisible();

    // Knappen ved "Hent opgørelse" skal være synlig, inaktiv og henvise til boksen ovenfor.
    const hentRow = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' });
    await expectDisabledDownloadTooltip(hentRow.getByRole('button'), PAGE_ERRORS);

    expect(runtimeErrors).toEqual([]);
  });

  /**
   * Dokumentaffordancen skal blive stående på en blokeret revision (auditfundene om Årsløn/EET, hvor
   * beregnings- og downloadfladen forsvandt helt fra DOM'en ved en stamdatafejl). En skjult knap gør
   * blokeringen tavs — der er da ingen tooltip at læse.
   */
  test('Årsløn og EET beholder en synlig, inaktiv downloadknap ved stamdatafejl', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);

    // En ugyldig skadedato gør stamdata rødt for begge sider på én gang.
    await page.getByRole('button', { name: 'Stamdata' }).click();
    const skadedato = page.locator("input[name='skadedato']");
    await setDate(skadedato, '31-02-2020');
    await expect(skadedato).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Årslønsberegning' }).click();
    const aarsloenRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Sammentælling af løn fra tabellen',
    });
    await expect(aarsloenRow.getByRole('button')).toBeVisible();
    await expect(aarsloenRow.getByRole('button')).toBeDisabled();

    await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
    await page.getByRole('tab', { name: 'Differencekrav' }).click();
    // `EetDocumentDownloadBox` renderes netop i den blokerede gren, så affordancen ikke forsvinder.
    const eetDownload = page.locator('.row--label-right-hover')
      .filter({ hasText: 'Download specifikation' })
      .getByRole('button');
    await expect(eetDownload).toBeVisible();
    await expect(eetDownload).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
  });
});

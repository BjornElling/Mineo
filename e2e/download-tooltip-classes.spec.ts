import { type Locator } from '@playwright/test';

import { expect, login, openPage, setFieldValueAndSettle, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

/**
 * Download-knappens tooltip: de tre brugerrettede klasser (brugerbeslutning 2026-08-13).
 *
 *  (a) Fejlen står i sidens fejl-/advarselsboks → «Opgørelse kan ikke hentes, når der er fejl ovenfor»
 *  (b) Et rødt felt blokerer                    → «Fejl i indtastning»
 *  (c) Et påkrævet felt er TOMT                 → «Indtastning mangler»
 *
 * Testen findes, fordi de tre tidligere kunne kollapse: en side kunne svare «Indtastning mangler» på et
 * felt, der var udfyldt med en ugyldig værdi, og Renteberegning viste gate-INTERNE strenge direkte. Kun en
 * browsertest ser den faktiske tooltip, brugeren læser – unit-testene hævder gate-klassen, ikke DOM'en.
 *
 * Den dækker samtidig, at dokumentaffordancen BLIVER stående på en blokeret revision: en skjult knap gør en
 * blokering tavs, og så har tooltippen intet at sidde på.
 */

const MISSING_INPUT = 'Indtastning mangler';
const INVALID_INPUT = 'Fejl i indtastning';
const PAGE_ERRORS = 'Opgørelse kan ikke hentes, når der er fejl ovenfor';
/** Codec-leveret konkret tekst for en velformet, men ikke-eksisterende kalenderdato. */
const NONEXISTENT_DAY = 'Datoen findes ikke i kalenderen';

/** Datoindtastning gennem den delte, tidsrobuste totrins-helper (se `support/mineoTest.ts`). */
const setDate = setVerbatimFieldValueAndSettle;

/** Den deaktiverede downloadknaps tooltip er dens accessible name (jf. `DownloadIconButton`). */
const expectDisabledDownloadTooltip = async (button: Locator, tooltip: string): Promise<void> => {
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleName(tooltip);
};

test.describe('Download-tooltip – de tre klasser', () => {
  /**
   * Varige mén afhænger af Stamdatas fødselsdato og skadedato. Den skelnen brugeren efterspurgte – tom vs.
   * rød – afgøres af `varigeMenReaderProjection`s `require`-reads, og vises her fra brugerens side af skærmen.
   */
  test('Varige mén skelner tom indtastning fra rød feltfejl', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Varige mén');

    /**
     * Knappen findes på sin RÆKKE, ikke på sit navn: navnet ER tooltippen, og den er netop det, testen
     * måler. Et navnebaseret selektor ville gøre en forkert tekst til "element not found".
     */
    const download = page.getByTestId('varigemen-download');

    // (c) Alt er tomt → manglende indtastning.
    await expectDisabledDownloadTooltip(download, MISSING_INPUT);

    // (b) En ugyldig fødselsdato (31-02 findes ikke i kalenderen) → rød feltfejl.
    await openPage(page, 'Stamdata');
    const fodselsdato = page.locator("input[name='skadelidteFodselsdato']");
    await setDate(fodselsdato, '31-02-1980');
    await expect(fodselsdato).toHaveAttribute('aria-invalid', 'true');

    await openPage(page, 'Varige mén');
    /**
     * Den røde dato optræder sammen med de øvrige manglende input. Downloaden må derfor ikke citere datoen
     * og skjule, at der også mangler méngrad og beregningsdato – gate-kontrakten kræver den fælles klasse.
     */
    await expectDisabledDownloadTooltip(download, INVALID_INPUT);

    /**
     * TO uafhængige røde felter → klasseteksten, ikke et citat. Det er lempelsens kerne: med to fejl ville
     * et citat af den ene udpege den som "fejlen" og skjule den anden. Felterne bærer selv deres beskeder.
     *
     * Méngrad bruges som andet felt frem for endnu en dato: `runProjection` dedupper issues på `kind:code`,
     * så to datofelter med samme fejlkode kollapser til ÉN post og ville forblive et lovligt enkeltcitat.
     */
    const mengrad = page.locator("input[name='mengrad']");
    await setFieldValueAndSettle(mengrad, '999');
    await expect(mengrad).toHaveAttribute('aria-invalid', 'true');
    await expectDisabledDownloadTooltip(download, INVALID_INPUT);

    // Rettes méngraden, er dato-fejlen stadig ledsaget af manglende input og skal fortsat bruge klasse-teksten.
    await setFieldValueAndSettle(mengrad, '10');
    await expect(mengrad).not.toHaveAttribute('aria-invalid', 'true');
    await expectDisabledDownloadTooltip(download, INVALID_INPUT);

    // Rettes datoen, falder gaten tilbage til de øvrige tomme felter – ikke til en stale rød tilstand.
    await openPage(page, 'Stamdata');
    await setDate(fodselsdato, '01-01-1980');
    await expect(fodselsdato).not.toHaveAttribute('aria-invalid', 'true');
    await openPage(page, 'Varige mén');
    await expectDisabledDownloadTooltip(download, MISSING_INPUT);

    expect(runtimeErrors).toEqual([]);
  });

  test('viser den konkrete kalenderfejl, når den er den eneste blokering', async ({ page }) => {
    await login(page);

    await openPage(page, 'Stamdata');
    const fodselsdato = page.locator("input[name='skadelidteFodselsdato']");
    await setDate(fodselsdato, '01-01-1980');
    await setDate(page.locator("input[name='skadedato']"), '01-01-2015');

    await openPage(page, 'Varige mén');
    await setFieldValueAndSettle(page.locator("input[name='mengrad']"), '10');
    await setDate(page.locator("input[name='beregningsdato']"), '01-01-2020');

    await openPage(page, 'Stamdata');
    await setDate(fodselsdato, '31-02-1980');
    await expect(fodselsdato).toHaveAttribute('aria-invalid', 'true');

    await openPage(page, 'Varige mén');
    await expectDisabledDownloadTooltip(page.getByTestId('varigemen-download'), NONEXISTENT_DAY);
  });

  /**
   * (a) Erstatningsopgørelsens fire knapper. Teksten kom før fra en hardkodet ternary i `EOberegningTab`,
   * som kastede gatens svar væk; nu er den gatens klasse `page-errors`. Brugeren skal se samme tekst som før.
   */
  test('Erstatningsopgørelse henviser til sin egen fejlboks', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Beregning' }).click();

    const fejlboks = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(fejlboks).toBeVisible();

    // Knappen ved "Hent opgørelse" skal være synlig, inaktiv og henvise til boksen ovenfor.
    const hentRow = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' });
    await expectDisabledDownloadTooltip(hentRow.getByRole('button'), PAGE_ERRORS);

    expect(runtimeErrors).toEqual([]);
  });

  /**
   * Brugerfundet 2026-08-15, målt fra brugerens side af skærmen.
   *
   * En lønrække med komplet periode (`11`/`2012`) og INTET beløb blokerede downloaden med «Fejl i
   * indtastning». Det er en ren mangel: brugeren blev sendt ud at lede efter en ugyldig værdi, der ikke
   * fandtes. Årsagen var, at gaten kollapsede HELE tabelvalideringen til én hardkodet klasse, selv om
   * `TableError.issue` allerede skelnede `invalid` fra `partial_period`/`missing_amount`.
   *
   * Testen måler BEGGE retninger i samme flow – mangel, gyldig, ugyldig – så en rettelse, der blot bytter
   * om på de to tekster, ikke kan være grøn.
   */
  test('Årslønnens løntabel skelner manglende beløb fra ugyldig celle', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');

    const download = page.locator('.row--label-right-hover')
      .filter({ hasText: 'Sammentælling af løn fra tabellen' })
      .getByRole('button');

    // Rækkerne bærer deres id som data-attribut; cellerne læses positionelt, fordi rækkens id dannes
    // først ved indtastning og derfor ikke kan skrives i testen.
    const firstRow = page.locator('tbody tr[data-mineo-row-id]').first();
    const maaned = firstRow.locator('input').nth(0);
    const aar = firstRow.locator('input').nth(1);
    const loen = firstRow.locator('input').nth(2);

    // Tom tabel → intet at hente, og der mangler indtastning.
    await expectDisabledDownloadTooltip(download, MISSING_INPUT);

    // (c) Brugerfundets tilstand: komplet periode, intet beløb.
    await setFieldValueAndSettle(maaned, '11');
    await setFieldValueAndSettle(aar, '2012');
    await expectDisabledDownloadTooltip(download, MISSING_INPUT);

    // Udfyldes beløbet, er grundlaget komplet, og knappen bliver aktiv. Uden dette trin kunne testen
    // være grøn af en gate, der ALTID svarer «Indtastning mangler».
    await setFieldValueAndSettle(loen, '234');
    await expect(download).toBeEnabled();

    // (b) En afvist celleværdi: måned 13 findes ikke → rød celle → «Fejl i indtastning».
    await setFieldValueAndSettle(maaned, '13');
    await expect(maaned).toHaveAttribute('aria-invalid', 'true');
    await expectDisabledDownloadTooltip(download, INVALID_INPUT);

    expect(runtimeErrors).toEqual([]);
  });

  /**
   * Dokumentaffordancen skal blive stående på en blokeret revision (auditfundene om Årsløn/EET, hvor
   * beregnings- og downloadfladen forsvandt helt fra DOM'en ved en stamdatafejl). En skjult knap gør
   * blokeringen tavs – der er da ingen tooltip at læse.
   */
  test('Årsløn og EET beholder en synlig, inaktiv downloadknap ved stamdatafejl', async ({ page, runtimeErrors }) => {
    await login(page);

    // En ugyldig skadedato gør stamdata rødt for begge sider på én gang.
    await openPage(page, 'Stamdata');
    const skadedato = page.locator("input[name='skadedato']");
    await setDate(skadedato, '31-02-2020');
    await expect(skadedato).toHaveAttribute('aria-invalid', 'true');

    await openPage(page, 'Årslønsberegning');
    const aarsloenRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Sammentælling af løn fra tabellen',
    });
    await expect(aarsloenRow.getByRole('button')).toBeVisible();
    await expect(aarsloenRow.getByRole('button')).toBeDisabled();

    await openPage(page, 'Erhvervsevnetab');
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

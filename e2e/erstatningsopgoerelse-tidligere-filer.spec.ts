import type { Page } from '@playwright/test';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { countFilledFields } from '../src/utils/dataCollection';
import { encryptToString } from '../src/utils/encryption';

import { expect, login, openPage, test } from './support/mineoTest';

const buildLegacyCase = (options: Readonly<{
  journalnr: string;
  periodeFra: string;
  periodeTil: string;
  missingClaimantName?: boolean;
  signatureLine?: boolean;
  tafPeriodBeforeInjury?: boolean;
  svieSmertePeriodBeforeInjury?: boolean;
}>) => {
  // 3.15-containeren er syntetisk, ikke et arkiveret brugerartefakt: den starter med den låste 3.14-testfil
  // og tilføjer præcis 3.15's nye enhedsfelt på begge lønobjekter. Det rammer den historiske
  // load-version og den daværende payloadform uden at foregive, at resten af testdataene er en optagelse
  // fra en faktisk 3.15-installation.
  const stamdata = {
    ...caseFixture.data.stamdata,
    journalnr: options.journalnr,
    skadestype: 'Arbejdsulykke' as const,
    skadedato: '2018-06-01',
    ...(options.missingClaimantName ? { skadelidte: undefined } : {}),
  };
  const erstatningsopgoerelse = {
    ...caseFixture.data.erstatningsopgoerelse,
    kravPaaTabtArbejdsfortjeneste: options.tafPeriodBeforeInjury ? 'Ja' as const : 'Nej' as const,
    tafPerioder: options.tafPeriodBeforeInjury
      ? [{ id: 'legacy-taf-before-injury', fra: '2010-01-01', til: '2010-12-31', loseFeriedage: 0 }]
      : [],
    svieSmertePerioder: options.svieSmertePeriodBeforeInjury
      ? [{ id: 'legacy-ss-before-injury', fra: '2010-01-01', til: '2010-02-01', tilstand: 'sygemeldt' as const }]
      : caseFixture.data.erstatningsopgoerelse.svieSmertePerioder,
    vedroererPeriodeFra: options.periodeFra,
    vedroererPeriodeTil: options.periodeTil,
    // Grundfixturet er fra 3.14. 3.15 gemmer brugerens enhed for forhøjet grundløn, så en sag mærket 3.15
    // skal bære feltet på både ansættelsesforholdet og den angivne løns reguleringsdel.
    loenindkomstAnsaettelsesforhold: caseFixture.data.erstatningsopgoerelse.loenindkomstAnsaettelsesforhold.map((af) => ({
      ...af,
      offentligLoenEkstraGrundloenAngivesPer: af.offentligLoenType === 'Timeløn' ? 'Time' as const : 'Måned' as const,
    })),
    eoAngivetLoenLoenudvikling: {
      ...caseFixture.data.erstatningsopgoerelse.eoAngivetLoenLoenudvikling,
      offentligLoenEkstraGrundloenAngivesPer:
        caseFixture.data.erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenType === 'Timeløn' ? 'Time' as const : 'Måned' as const,
    },
    ...(options.signatureLine ? { erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje' as const } : {}),
  };
  const data = { ...caseFixture.data, stamdata, erstatningsopgoerelse };
  return {
    ...caseFixture,
    _metadata: {
      ...caseFixture._metadata,
      // Build-info-formatet fra 3.15-udgivelsescommitten e5b3d78c (2026.10.2233.e5b3d78).
      exportDate: '2026-10-16T12:00:00.000Z',
      appVersion: '2026.10.2233.e5b3d78',
      persistedDataVersion: '3.15',
      fieldCount: countFilledFields(data),
    },
    data,
  };
};

const useFilePickerFallback = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
  });
};

const loadLegacyCase = async (
  page: Page,
  fileName: string,
  container: unknown,
): Promise<void> => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent', exact: true }).click();
  await (await chooser).setFiles({
    name: fileName,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(await encryptToString(container)),
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Filen er indlæst – nogle felter blev sat til standardværdier.', { exact: true }))
    .toHaveCount(0);
}

type LegacyInspectionScenario = 'absence-red' | 'taf-red' | 'period-overlap';

const getLastTwoOctoberWeekdays = (year: number) =>
  Array.from({ length: 31 }, (_, index) => new Date(Date.UTC(year, 9, index + 1)))
    .filter((date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
    .slice(-2)
    .map((date) => ({
      iso: `${year}-10-${String(date.getUTCDate()).padStart(2, '0')}`,
      display: `${String(date.getUTCDate()).padStart(2, '0')}-10-${year}`,
    }));

const buildLegacyInspectionCase = (scenario: LegacyInspectionScenario) => {
  const year = new Date().getFullYear();
  const usesJanuary2026 = scenario === 'period-overlap';
  const periodFra = usesJanuary2026
    ? '2026-01-01'
    : scenario === 'absence-red'
      ? `${year}-10-01`
      : `${year + 1}-12-01`;
  const calculationTil = usesJanuary2026
    ? '2026-01-31'
    : scenario === 'absence-red'
      ? `${year}-10-31`
      : `${year + 1}-12-31`;
  const erstatningsFra = periodFra;
  const erstatningsTil = calculationTil;
  const tafFra = scenario === 'period-overlap'
    ? '2026-01-15'
    : scenario === 'absence-red'
      ? `${year}-08-01`
    : scenario === 'taf-red'
      ? `${year + 1}-12-30`
      : '2026-08-01';
  const tafTil = scenario === 'period-overlap'
    ? '2026-01-20'
    : scenario === 'absence-red'
      ? `${year}-08-31`
    : scenario === 'taf-red'
      ? `${year + 2}-01-10`
      : '2026-08-31';
  const lastOctoberWeekdays = getLastTwoOctoberWeekdays(year);
  const absenceFra = scenario === 'absence-red' ? lastOctoberWeekdays[0]?.iso : undefined;
  const absenceTil = `${year + 2}-01-10`;
  const hasAbsenceRow = scenario === 'absence-red';
  const data = {
    ...caseFixture.data,
    stamdata: {
      ...caseFixture.data.stamdata,
      journalnr: `LEGACY-INSPECTION-${scenario}`,
      skadedato: '2018-06-01',
    },
    erstatningsopgoerelse: {
      ...caseFixture.data.erstatningsopgoerelse,
      vedroererPeriodeFra: erstatningsFra,
      vedroererPeriodeTil: erstatningsTil,
      beregnesUdFra: scenario === 'taf-red' ? 'Angivet dagsløn' as const : 'Beregningsperiode' as const,
      tafBeregningsperiodeFra: periodFra,
      tafBeregningsperiodeTil: calculationTil,
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      kravPaaSvieSmerteGodtgoerelse: 'Nej' as const,
      svieSmertePerioder: [],
      offentligeYdelserRows: [],
      tafPerioder: [{ id: 'legacy-inspection-taf', fra: tafFra, til: tafTil, loseFeriedage: 0 }],
      ferieperioder: [{ id: 'legacy-inspection-empty-taf-holiday' }],
      fravaerPerioder: hasAbsenceRow && absenceFra
        ? [{ id: 'legacy-inspection-absence', fra: absenceFra, til: absenceTil }]
        : [],
      uspecificeredeFerieFridage: 0,
      oevrigtFravaerUdenLoen: 'Nej' as const,
      loenindkomstAnsaettelsesforhold: caseFixture.data.erstatningsopgoerelse.loenindkomstAnsaettelsesforhold.map((employment) => ({
        ...employment,
        ...(scenario === 'absence-red' ? { loenPaaHelligdage: 'Ingen' as const } : {}),
        ...(scenario === 'absence-red' ? {
          loenperiode: 'maaned' as const,
          indtaegtsoplysningerTableData: (employment.indtaegtsoplysningerTableData ?? []).slice(0, 1).map((row) => ({
            ...row,
            col0_maaned: '10',
            col1_maaned: String(year),
          })),
        } : {}),
      })),
    },
  };

  return {
    ...caseFixture,
    _metadata: {
      ...caseFixture._metadata,
      fieldCount: countFilledFields(data),
    },
    data,
  };
};

const openControlTable = async (page: Page): Promise<void> => {
  await openPage(page, 'Indstillinger');
  const showControlTabs = page.getByRole('checkbox', {
    name: 'Vis kontrolfaner på Erstatningsopgørelse-side',
  });
  if (!(await showControlTabs.isChecked())) await showControlTabs.click();

  await openPage(page, 'Erstatningsopgørelse');
  await page.getByRole('button', { name: 'EO-kontrol', exact: true }).click();
  await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
  await expect(page.getByText('Sammentælling', { exact: true })).toBeVisible();
};

const sammentaellingRows = (page: Page) => page.locator('.content-box')
  .filter({ hasText: 'Sammentælling' })
  .locator('table').first().locator('tbody tr');

const scrollControlTableToBottom = async (page: Page): Promise<void> => {
  await page.locator('[data-mineo-scroll-container="true"]').evaluate((container) => {
    container.scrollTop = container.scrollHeight;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
};

const fejlBoks = (page: Page) =>
  page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

const hentKnap = (page: Page) =>
  page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' }).getByRole('button');

test.describe('Erstatningsopgørelse – tidligere gemte filer', () => {
  test('den låste 3.14-fil bevarer BB-242-datoerne og viser den ikke-blokerende advarsel efter load', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await useFilePickerFallback(page);
    await login(page);

    const data = {
      ...caseFixture.data,
      stamdata: {
        ...caseFixture.data.stamdata,
        skadedato: '2018-06-01',
      },
      erstatningsopgoerelse: {
        ...caseFixture.data.erstatningsopgoerelse,
        opgørelseLavetDen: '2025-02-01',
        varigeMenAfgorelse: 'Ja' as const,
        menAfgoerelseDato: '2025-06-01',
        // Fixtureens S/S-periode ligger efter ménafgørelsen; fjern det uvedkommende stop, så denne case isolerer BB-242.
        kravPaaSvieSmerteGodtgoerelse: 'Nej' as const,
        svieSmertePerioder: [],
      },
    };
    const legacy314Case = {
      ...caseFixture,
      _metadata: {
        ...caseFixture._metadata,
        fieldCount: countFilledFields(data),
      },
      data,
    };
    expect(legacy314Case._metadata.persistedDataVersion).toBe('3.14');

    await loadLegacyCase(page, 'bb-242-afgoerelse-efter-opgoerelsen-3.14.eo', legacy314Case);
    await openPage(page, 'Erstatningsopgørelse');

    const opgoerelseDato = page.locator("input[name='opgørelseLavetDen']");
    const menDato = page.getByRole('textbox', { name: 'Dato for første ménafgørelse' });
    await expect(opgoerelseDato).toHaveValue('01-02-2025');
    await expect(menDato).toHaveValue('01-06-2025');
    await expect(menDato).toHaveAttribute('aria-invalid', 'false');
    await expect(menDato).toHaveAccessibleDescription(
      /Afgørelsen er dateret efter opgørelsens dato \(01-02-2025\)/
    );

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText(
      'Dato for første ménafgørelse: Afgørelsen er dateret efter opgørelsens dato (01-02-2025)'
    );
    await expect(hentKnap(page)).toBeEnabled();
    await expect(opgoerelseDato).toHaveValue('01-02-2025');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('den låste 3.14-fil bevarer periode før skaden og får den godkendte røde fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);

    // Brug den låste 3.14-container og dens oprindelige metadata/payloadform. Kun sagsdatoerne ændres
    // for at fremkalde den godkendte fejl; 3.15-felter eller anden versionsmærkning tilføjes ikke.
    const legacy314Case = {
      ...caseFixture,
      data: {
        ...caseFixture.data,
        stamdata: {
          ...caseFixture.data.stamdata,
          skadedato: '2018-06-01',
        },
        erstatningsopgoerelse: {
          ...caseFixture.data.erstatningsopgoerelse,
          vedroererPeriodeFra: '2010-01-01',
          vedroererPeriodeTil: '2018-12-31',
        },
      },
    };
    expect(legacy314Case._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'periode-foer-skade-3.14.eo', legacy314Case);

    await openPage(page, 'Erstatningsopgørelse');
    const periodeFra = page.locator("input[name='vedroererPeriodeFra']");
    await expect(periodeFra).toHaveValue('01-01-2010');
    await expect(periodeFra).toHaveAttribute('aria-invalid', 'true');
    await expect(periodeFra).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Datoen kan ikke være før skadedatoen (01-06-2018)');
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-3-14-periode-foer-skade.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('den låste 3.14-fil bevarer en TAF-periode før skaden uden load-advarsel og får den røde fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);

    // Den låste 3.14-payload ændres kun i den eksisterende første TAF-rækkes datoer og skadedato.
    const legacy314Case = {
      ...caseFixture,
      data: {
        ...caseFixture.data,
        stamdata: {
          ...caseFixture.data.stamdata,
          skadedato: '2018-06-01',
        },
        erstatningsopgoerelse: {
          ...caseFixture.data.erstatningsopgoerelse,
          tafPerioder: caseFixture.data.erstatningsopgoerelse.tafPerioder.map((row, index) =>
            index === 0 ? { ...row, fra: '2010-01-01', til: '2010-12-31' } : row
          ),
        },
      },
    };
    expect(legacy314Case._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'taf-foer-skade-3.14.eo', legacy314Case);

    await openPage(page, 'Erstatningsopgørelse');
    const tafRow = page.locator('[data-section-id="taf"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first();
    const tafDates = tafRow.locator('input[data-mineo-field-address]');
    await expect(tafDates.nth(0)).toHaveValue('01-01-2010');
    await expect(tafDates.nth(1)).toHaveValue('31-12-2010');
    await expect(tafDates.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tafDates.nth(0)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);
    await expect(tafDates.nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(tafDates.nth(1)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText(
      'TAF-perioden 01-01-2010 - 31-12-2010: Datoen kan ikke være før skadedatoen (01-06-2018)'
    );
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-3-14-taf-foer-skade.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('den låste 3.14-fil bevarer en svie/smerte-periode før skaden uden load-advarsel og får den røde fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);

    // Den låste 3.14-payload ændres kun i første svie/smerte-rækkes datoer og skadedato.
    const legacy314Case = {
      ...caseFixture,
      data: {
        ...caseFixture.data,
        stamdata: {
          ...caseFixture.data.stamdata,
          skadedato: '2018-06-01',
        },
        erstatningsopgoerelse: {
          ...caseFixture.data.erstatningsopgoerelse,
          svieSmertePerioder: caseFixture.data.erstatningsopgoerelse.svieSmertePerioder.map((row, index) =>
            index === 0 ? { ...row, fra: '2010-01-01', til: '2010-02-01' } : row
          ),
        },
      },
    };
    expect(legacy314Case._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'svie-smerte-foer-skade-3.14.eo', legacy314Case);

    await openPage(page, 'Erstatningsopgørelse');
    const ssRow = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]').first();
    const ssDates = ssRow.locator('input[data-mineo-field-address]');
    await expect(ssDates.nth(0)).toHaveValue('01-01-2010');
    await expect(ssDates.nth(1)).toHaveValue('01-02-2010');
    await expect(ssDates.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(ssDates.nth(0)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);
    await expect(ssDates.nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(ssDates.nth(1)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Datoen kan ikke være før skadedatoen (01-06-2018)');
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-3-14-svie-smerte-foer-skade.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('den låste 3.14-fil bevarer underskriftsvalget uden navn og får den godkendte blokerende fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);

    // Den låste 3.14-payload ændres kun ved at tømme det eksisterende navn og vælge underskriftslinje.
    const legacy314Case = {
      ...caseFixture,
      data: {
        ...caseFixture.data,
        stamdata: {
          ...caseFixture.data.stamdata,
          skadelidte: undefined,
        },
        erstatningsopgoerelse: {
          ...caseFixture.data.erstatningsopgoerelse,
          erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje' as const,
        },
      },
    };
    expect(legacy314Case._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'underskrift-uden-navn-3.14.eo', legacy314Case);

    await openPage(page, 'Stamdata');
    await expect(page.locator("input[name='skadelidte']")).toHaveValue('');
    await openPage(page, 'Erstatningsopgørelse');
    await expect(page.getByRole('combobox', { name: 'Erstatningsopgørelse afsluttes med', exact: true }))
      .toHaveValue('Underskrift-linje');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Skadelidtes navn skal angives, når opgørelsen afsluttes med en underskrift-linje');
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-3-14-underskrift-uden-navn.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en 3.15-fil bevarer perioden før skaden og får den godkendte røde fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);
    await loadLegacyCase(page, 'periode-foer-skade-3.15.eo', buildLegacyCase({
      journalnr: 'LEGACY-BB-334',
      periodeFra: '2010-01-01',
      periodeTil: '2018-12-31',
    }));

    await openPage(page, 'Erstatningsopgørelse');
    const periodeFra = page.locator("input[name='vedroererPeriodeFra']");
    await expect(periodeFra).toHaveValue('01-01-2010');
    await expect(periodeFra).toHaveAttribute('aria-invalid', 'true');
    await expect(periodeFra).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Datoen kan ikke være før skadedatoen (01-06-2018)');
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-periode-foer-skade.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en 3.15-fil bevarer en TAF-periode før skaden uden load-advarsel og får den nye røde fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);
    await loadLegacyCase(page, 'taf-foer-skade-3.15.eo', buildLegacyCase({
      journalnr: 'LEGACY-TAF-BEFORE-INJURY',
      periodeFra: '2018-06-01',
      periodeTil: '2018-12-31',
      tafPeriodBeforeInjury: true,
    }));

    await openPage(page, 'Erstatningsopgørelse');
    const tafRow = page.locator('[data-section-id="taf"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first();
    const tafDates = tafRow.locator('input[data-mineo-field-address]');
    await expect(tafDates.nth(0)).toHaveValue('01-01-2010');
    await expect(tafDates.nth(1)).toHaveValue('31-12-2010');
    await expect(tafDates.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tafDates.nth(0)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);
    await expect(tafDates.nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(tafDates.nth(1)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText(
      'TAF-perioden 01-01-2010 - 31-12-2010: Datoen kan ikke være før skadedatoen (01-06-2018)'
    );
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-taf-foer-skade.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en 3.15-fil bevarer en svie/smerte-periode før skaden uden load-advarsel og får den nye røde fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);
    await loadLegacyCase(page, 'svie-smerte-foer-skade-3.15.eo', buildLegacyCase({
      journalnr: 'LEGACY-SS-BEFORE-INJURY',
      periodeFra: '2018-06-01',
      periodeTil: '2018-12-31',
      svieSmertePeriodBeforeInjury: true,
    }));

    await openPage(page, 'Erstatningsopgørelse');
    const ssRow = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]').first();
    const ssDates = ssRow.locator('input[data-mineo-field-address]');
    await expect(ssDates.nth(0)).toHaveValue('01-01-2010');
    await expect(ssDates.nth(1)).toHaveValue('01-02-2010');
    await expect(ssDates.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(ssDates.nth(0)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);
    await expect(ssDates.nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(ssDates.nth(1)).toHaveAccessibleDescription(/Datoen kan ikke være før skadedatoen \(01-06-2018\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Datoen kan ikke være før skadedatoen (01-06-2018)');
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-svie-smerte-foer-skade.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en 3.15-fil uden navn bevarer underskriftsvalget og får den godkendte blokerende fejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await useFilePickerFallback(page);
    await login(page);
    await loadLegacyCase(page, 'underskrift-uden-navn-3.15.eo', buildLegacyCase({
      journalnr: 'LEGACY-BB-335',
      periodeFra: '2018-06-01',
      periodeTil: '2018-12-31',
      missingClaimantName: true,
      signatureLine: true,
    }));

    await openPage(page, 'Stamdata');
    await expect(page.locator("input[name='skadelidte']")).toHaveValue('');
    await openPage(page, 'Erstatningsopgørelse');
    await expect(page.getByRole('combobox', { name: 'Erstatningsopgørelse afsluttes med', exact: true }))
      .toHaveValue('Underskrift-linje');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Skadelidtes navn skal angives, når opgørelsen afsluttes med en underskrift-linje');
    await expect(hentKnap(page)).toBeDisabled();
    await fejlBoks(page).screenshot({ path: testInfo.outputPath('gammel-underskrift-uden-navn.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en ældre fil bevarer fraværets Feriedage og EO-kontrollens markeringer ved rød slutdato', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await useFilePickerFallback(page);
    await login(page);
    const legacyCase = buildLegacyInspectionCase('absence-red');
    expect(legacyCase._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'fravaer-roed-slutdato-3.14.eo', legacyCase);

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Måned', exact: true })).toBeChecked();
    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    const year = new Date().getFullYear();
    const octoberWeekdays = getLastTwoOctoberWeekdays(year);
    const firstAbsenceDay = octoberWeekdays[0];
    if (!firstAbsenceDay) throw new Error('Oktober mangler arbejdsdage i fixtureåret.');
    const absenceSection = page.locator('[data-section-id="taf-beregningsgrundlag"]');
    const absenceTable = absenceSection.locator('table').filter({ hasText: 'Feriedage' }).first();
    const absenceRow = absenceTable.locator('tbody tr[data-mineo-row-id]').first();
    const absenceDates = absenceRow.locator('input[data-mineo-field-address]');
    await expect(absenceDates.nth(0)).toHaveValue(firstAbsenceDay.display);
    await expect(absenceDates.nth(1)).toHaveValue(`10-01-${year + 2}`);
    await expect(absenceDates.nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(absenceRow.locator('td').nth(2)).toHaveText('2');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Dato skal være mellem');
    await expect(hentKnap(page)).toBeDisabled();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);

    await openControlTable(page);
    const beregningsperiodeRow = sammentaellingRows(page).filter({ hasText: 'Arbejdsdage i beregningsperiode' });
    await expect(beregningsperiodeRow.locator('td').first()).toContainText('2 feriedage');

    await scrollControlTableToBottom(page);
    const dailyTable = page.locator('table').filter({
      has: page.locator('th[data-mineo-column-id="base:date"]'),
    });
    for (const { display } of octoberWeekdays) {
      const dayRow = dailyTable.locator('tbody tr').filter({ hasText: display });
      await expect(dayRow.locator('td[data-mineo-column-id="base:ferie_day"]')).toHaveText('x');
    }

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(hentKnap(page)).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en ældre fil bevarer TAF-rækkens 2 dage, men skjuler den røde rækkes kontrolsammenligning', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await useFilePickerFallback(page);
    await login(page);
    const legacyCase = buildLegacyInspectionCase('taf-red');
    expect(legacyCase._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'taf-roed-slutdato-3.14.eo', legacyCase);

    await openPage(page, 'Erstatningsopgørelse');
    const tafRow = page.locator('[data-section-id="taf"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first();
    const tafDates = tafRow.locator('input[data-mineo-field-address]');
    await expect(tafDates.nth(0)).toHaveValue(`30-12-${new Date().getFullYear() + 1}`);
    await expect(tafDates.nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(tafRow.locator('td').last()).toHaveText('2');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Dato skal være mellem');
    await expect(hentKnap(page)).toBeDisabled();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);

    await openControlTable(page);
    const tafSummaryRow = sammentaellingRows(page).filter({ hasText: 'Arbejdsdage i TAF-periode' });
    await expect(tafSummaryRow.locator('td').nth(1)).toHaveText('-');
    await expect(tafSummaryRow.locator('td').nth(2)).toHaveText('-');

    const intervalTable = page.locator('.content-box').filter({ hasText: 'Kontroltabel' }).locator('table').first();
    const tafIntervalRow = intervalTable.locator('tbody tr').filter({ hasText: 'TAF-perioder' });
    await expect(tafIntervalRow.locator('td').nth(1)).toHaveText('-');
    await expect(tafIntervalRow.locator('td').nth(2)).toHaveText('-');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(hentKnap(page)).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en ældre fil viser 22/22 ved overlappende beregningsperiode uden falsk kontrolfejl', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await useFilePickerFallback(page);
    await login(page);
    const legacyCase = buildLegacyInspectionCase('period-overlap');
    expect(legacyCase._metadata.persistedDataVersion).toBe('3.14');
    await loadLegacyCase(page, 'beregningsperiode-overlap-3.14.eo', legacyCase);

    await openPage(page, 'Erstatningsopgørelse');
    const beregningsperiodeFra = page.locator("input[name='tafBeregningsperiodeFra']");
    const beregningsperiodeTil = page.locator("input[name='tafBeregningsperiodeTil']");
    await expect(beregningsperiodeFra).toHaveAttribute('aria-invalid', 'true');
    await expect(beregningsperiodeTil).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(fejlBoks(page)).toContainText('Der er overlap mellem beregningsperioden');
    await expect(hentKnap(page)).toBeDisabled();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);

    await openControlTable(page);
    const beregningsperiodeRow = sammentaellingRows(page).filter({ hasText: 'Arbejdsdage i beregningsperiode' });
    await expect(beregningsperiodeRow.locator('td').nth(1)).toHaveText('22');
    await expect(beregningsperiodeRow.locator('td').nth(2)).toHaveText('22');

    const tafSummaryRow = sammentaellingRows(page).filter({ hasText: 'Arbejdsdage i TAF-periode' });
    await expect(tafSummaryRow.locator('td').nth(1)).toHaveText('-');
    await expect(tafSummaryRow.locator('td').nth(2)).toHaveText('-');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(hentKnap(page)).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

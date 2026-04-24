/// <reference types="vitest/globals" />

import { buildEODebugModel } from '../../../domain/debug/eoDebugModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const base = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  beregnesUdFra: 'Angivet månedsløn' as const,
});

// ─── Tom model (ingen datoer sat) ─────────────────────────────────────────────

describe('buildEODebugModel — tom input (ingen datoer)', () => {
  it('returnerer rowCount=0 og tomme kolonner/rækker når ingen datoer er sat', () => {
    const model = buildEODebugModel(base());
    expect(model.rowCount).toBe(0);
    expect(model.columns).toHaveLength(0);
    expect(model.rows).toHaveLength(0);
  });

  it('kombinedMinFra og kombinedMaxTil er undefined ved tomt input', () => {
    const model = buildEODebugModel(base());
    expect(model.combinedMinFra).toBeUndefined();
    expect(model.combinedMaxTil).toBeUndefined();
  });

  it('integrityIssues er tom ved tomt input', () => {
    const model = buildEODebugModel(base());
    expect(model.integrityIssues).toHaveLength(0);
  });
});

// ─── Kilde-bounds (sources) ────────────────────────────────────────────────────

describe('buildEODebugModel — kilde-bounds (sources)', () => {
  it('indeholder altid 5 kilde-entries', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
    });
    expect(model.sources).toHaveLength(5);
  });

  it('erstatningsperiode bounds er sat korrekt', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
    });
    const src = model.sources.find((s) => s.label === 'Erstatningsperiode');
    expect(src?.fra).toBe('2024-03-01');
    expect(src?.til).toBe('2024-03-31');
  });

  it('beregningsperiode bounds er undefined når beregnesUdFra ikke er Beregningsperiode', () => {
    const model = buildEODebugModel({
      ...base(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      tafBeregningsperiodeFra: '2023-01-01' as never,
      tafBeregningsperiodeTil: '2023-12-31' as never,
    });
    const src = model.sources.find((s) => s.label === 'Beregningsperiode');
    expect(src?.fra).toBeUndefined();
    expect(src?.til).toBeUndefined();
  });

  it('beregningsperiode bounds er sat når beregnesUdFra er Beregningsperiode', () => {
    const model = buildEODebugModel({
      ...base(),
      beregnesUdFra: 'Beregningsperiode' as const,
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-12-31' as never,
      tafBeregningsperiodeFra: '2023-06-01' as never,
      tafBeregningsperiodeTil: '2024-05-31' as never,
    });
    const src = model.sources.find((s) => s.label === 'Beregningsperiode');
    expect(src?.fra).toBe('2023-06-01');
    expect(src?.til).toBe('2024-05-31');
  });

  it('kombinedMinFra er minimum på tværs af alle kilder', () => {
    // Erstatningsperiode: 2024-03-01 til 2024-06-30
    // Beregningsperiode: 2023-01-01 til 2023-12-31 → mindste
    const model = buildEODebugModel({
      ...base(),
      beregnesUdFra: 'Beregningsperiode' as const,
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-06-30' as never,
      tafBeregningsperiodeFra: '2023-01-01' as never,
      tafBeregningsperiodeTil: '2023-12-31' as never,
    });
    expect(model.combinedMinFra).toBe('2023-01-01');
  });

  it('kombinedMaxTil er maximum på tværs af alle kilder', () => {
    const model = buildEODebugModel({
      ...base(),
      beregnesUdFra: 'Beregningsperiode' as const,
      vedroererPeriodeFra: '2023-01-01' as never,
      vedroererPeriodeTil: '2023-06-30' as never,
      tafBeregningsperiodeFra: '2022-01-01' as never,
      tafBeregningsperiodeTil: '2023-09-30' as never,
    });
    expect(model.combinedMaxTil).toBe('2023-09-30');
  });

  it('medtager svie/smerte som kilde når kun svie/smerte-perioder driver tabellen', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-26' as never,
      vedroererPeriodeTil: '2025-11-02' as never,
      beregnesSvieSmerteGodtgoerelse: 'Ja' as const,
      svieSmertePerioder: [
        { id: 'ss-1', fra: '2024-01-26', til: '2024-10-20', tilstand: 'sygemeldt' },
        { id: 'ss-2', fra: '2025-08-12', til: '2025-09-22', tilstand: 'sygemeldt' },
        { id: 'ss-3', fra: '2025-09-23', til: '2025-11-02', tilstand: 'delvist-sygemeldt' },
      ] as never,
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [],
    });

    const src = model.sources.find((source) => source.label === 'Svie/smerte');
    expect(src?.fra).toBe('2024-01-26');
    expect(src?.til).toBe('2025-11-02');
    expect(model.rowCount).toBeGreaterThan(0);
  });
});

// ─── Table-range (summaryTable) ────────────────────────────────────────────────

describe('buildEODebugModel — summaryTableFra/Til (månedsgrænser)', () => {
  it('summaryTableFra er første dag i måneden for combinedMinFra', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-15' as never,
      vedroererPeriodeTil: '2024-04-15' as never,
    });
    // 2024-03-15 → tableFra = 2024-03-01
    expect(model.summaryTableFra).toBe('2024-03-01');
  });

  it('summaryTableTil er sidste dag i måneden for combinedMaxTil', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-15' as never,
      vedroererPeriodeTil: '2024-04-15' as never,
    });
    // 2024-04-15 → tableTil = 2024-04-30
    expect(model.summaryTableTil).toBe('2024-04-30');
  });

  it('summaryTableTil håndterer februar korrekt (ikke-skudår)', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2023-02-01' as never,
      vedroererPeriodeTil: '2023-02-15' as never,
    });
    // 2023 er ikke skudår → feb = 28 dage
    expect(model.summaryTableTil).toBe('2023-02-28');
  });

  it('summaryTableTil håndterer februar i skudår', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-02-01' as never,
      vedroererPeriodeTil: '2024-02-15' as never,
    });
    // 2024 er skudår → feb = 29 dage
    expect(model.summaryTableTil).toBe('2024-02-29');
  });
});

// ─── Rækkegenerering ──────────────────────────────────────────────────────────

describe('buildEODebugModel — rækkegenerering', () => {
  it('rowCount matcher antallet af dage i tabelperioden', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-15' as never,
      vedroererPeriodeTil: '2024-01-17' as never,
    });
    // tableFra = 2024-01-01, tableTil = 2024-01-31 → 31 dage
    expect(model.rowCount).toBe(31);
  });

  it('rows.length === rowCount', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-01' as never,
    });
    expect(model.rows.length).toBe(model.rowCount);
  });

  it('getRowKey returnerer ISO-dato for gyldig rowIndex', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
    });
    expect(model.getRowKey(0)).toBe('2024-01-01');
    expect(model.getRowKey(30)).toBe('2024-01-31');
  });

  it('tableData.dates har korrekt første og sidste dato', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-06-15' as never,
      vedroererPeriodeTil: '2024-06-15' as never,
    });
    // tableFra = 2024-06-01, tableTil = 2024-06-30 → 30 dage
    expect(model.tableData.dates[0]).toBe('2024-06-01');
    expect(model.tableData.dates[29]).toBe('2024-06-30');
  });
});

// ─── Basiskolonner ────────────────────────────────────────────────────────────

describe('buildEODebugModel — basiskolonner', () => {
  const withJanuary = () => buildEODebugModel({
    ...base(),
    vedroererPeriodeFra: '2024-01-01' as never,
    vedroererPeriodeTil: '2024-01-31' as never,
  });

  it('indeholder basiskolonnerne: weekday, date, hverdag, sh_day, feriedag, arbejdsdag, ss_day', () => {
    const model = withJanuary();
    const ids = model.columns.map((c) => c.id);
    expect(ids).toContain('base:weekday');
    expect(ids).toContain('base:date');
    expect(ids).toContain('base:hverdag');
    expect(ids).toContain('base:sh_day');
    expect(ids).toContain('base:ferie_day');
    expect(ids).toContain('base:arbejdsdag');
    expect(ids).toContain('base:ss_day');
  });

  it('2024-01-01 (nytårsdag, mandag) er markeret som S/H-dag', () => {
    const model = withJanuary();
    const idx = model.tableData.dates.indexOf('2024-01-01' as never);
    expect(model.getCell(idx, 'base:sh_day')).toBe('x');
  });

  it('2024-01-06 (lørdag) er ikke hverdag', () => {
    const model = withJanuary();
    const idx = model.tableData.dates.indexOf('2024-01-06' as never);
    expect(model.getCell(idx, 'base:hverdag')).toBe('');
  });

  it('2024-01-08 (mandag, ingen SH) er hverdag', () => {
    const model = withJanuary();
    const idx = model.tableData.dates.indexOf('2024-01-08' as never);
    expect(model.getCell(idx, 'base:hverdag')).toBe('x');
  });
});

// ─── Ferie-set ────────────────────────────────────────────────────────────────

describe('buildEODebugModel — ferie-set', () => {
  it('ferieperiode-dag markeres som feriedag og ikke som arbejdsdag (ved Arbejdsdage)', () => {
    const model = buildEODebugModel({
      ...base(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
      ferieperioder: [{ id: 'f1', fra: '2024-03-04', til: '2024-03-04' }] as never,
    });
    const idx = model.tableData.dates.indexOf('2024-03-04' as never);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(model.getCell(idx, 'base:ferie_day')).toBe('x');
    expect(model.getCell(idx, 'base:arbejdsdag')).toBe('');
  });

  it('fravaerPerioder medregnes i ferie-set', () => {
    const model = buildEODebugModel({
      ...base(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
      fravaerPerioder: [{ id: 'f2', fra: '2024-03-05', til: '2024-03-05' }] as never,
    });
    const idx = model.tableData.dates.indexOf('2024-03-05' as never);
    expect(model.getCell(idx, 'base:ferie_day')).toBe('x');
  });

  it('weekend-dag i ferieperiode markeres ikke som feriedag', () => {
    // 2024-03-09 er lørdag
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
      ferieperioder: [{ id: 'f3', fra: '2024-03-09', til: '2024-03-09' }] as never,
    });
    const idx = model.tableData.dates.indexOf('2024-03-09' as never);
    expect(model.getCell(idx, 'base:ferie_day')).toBe('');
  });
});

describe('buildEODebugModel — TAF fallback', () => {
  it('bruger skadedatoISO ved fallback-beregning af TAF-ranges', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      midlertidigtEETAfgorelse: 'Ja' as const,
      midlertidigEETVirkningsdato: '2024-01-10' as never,
      verserendeKlageEet: 'Nej' as const,
      tafPerioder: [
        { id: 'taf-1', fra: '2024-01-01', til: '2024-01-31', loseFeriedage: 0 },
      ] as never,
    }, { skadedatoISO: '2010-06-15' as never });

    const beforeCutoffIndex = model.tableData.dates.indexOf('2024-01-09' as never);
    const cutoffIndex = model.tableData.dates.indexOf('2024-01-10' as never);

    expect(model.tableData.tafDayStatusByIndex[beforeCutoffIndex]).toBe('Ja');
    expect(model.tableData.tafDayStatusByIndex[cutoffIndex]).toBe('-');
  });
});

// ─── SS-coverage ──────────────────────────────────────────────────────────────

describe('buildEODebugModel — SS-dag (svie/smerte)', () => {
  it('sygemeldt-periode → Ja i S/S-kolonnen for dage indenfor erstatningsperioden', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
      svieSmertePerioder: [
        { id: 'ss1', fra: '2024-03-04', til: '2024-03-06', tilstand: 'sygemeldt' },
      ] as never,
    });
    const idx = model.tableData.dates.indexOf('2024-03-04' as never);
    expect(model.getCell(idx, 'base:ss_day')).toBe('Ja');
  });

  it('delvist-sygemeldt → Delvis i S/S-kolonnen', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-01' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
      svieSmertePerioder: [
        { id: 'ss2', fra: '2024-03-10', til: '2024-03-10', tilstand: 'delvist-sygemeldt' },
      ] as never,
    });
    const idx = model.tableData.dates.indexOf('2024-03-10' as never);
    expect(model.getCell(idx, 'base:ss_day')).toBe('Delvis');
  });

  it('dag udenfor erstatningsperioden har tom streng i S/S-kolonnen', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-03-05' as never,
      vedroererPeriodeTil: '2024-03-31' as never,
    });
    // 2024-03-01 er i tabellen (tableFra=2024-03-01) men udenfor erstatningsperioden
    const idx = model.tableData.dates.indexOf('2024-03-01' as never);
    expect(model.getCell(idx, 'base:ss_day')).toBe('');
  });
});

// ─── getCell ──────────────────────────────────────────────────────────────────

describe('buildEODebugModel — getCell', () => {
  it('getCell returnerer tom streng for ukendt kolonne-id', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
    });
    expect(model.getCell(0, 'base:ukendt' as never)).toBe('');
  });

  it('getCell returnerer ugedag-navn for weekday-kolonnen', () => {
    // 2024-01-01 er mandag
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
    });
    const idx = model.tableData.dates.indexOf('2024-01-01' as never);
    expect(model.getCell(idx, 'base:weekday')).toBe('Mandag');
  });

  it('rows[i].cells[colId] matcher getCell(i, colId)', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-07' as never,
    });
    for (let i = 0; i < model.rowCount; i += 1) {
      const row = model.rows[i];
      for (const col of model.columns) {
        expect(row.cells[col.id]).toBe(model.getCell(i, col.id));
      }
    }
  });
});

// ─── columnRawValues ──────────────────────────────────────────────────────────

describe('buildEODebugModel — columnRawValues', () => {
  it('returnerer et Map-objekt (evt. tomt)', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
    });
    expect(model.columnRawValues).toBeInstanceOf(Map);
  });
});

// ─── Loen/offentligeydelser kolonner (smoke-tests) ────────────────────────────

describe('buildEODebugModel — loenindkomst og offentligeydelser kolonner (smoke)', () => {
  it('viser kun én fælles TAF dag-kolonne selv ved flere ansættelsesforhold', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      tafPerioder: [{ id: 'taf-1', fra: '2024-01-02', til: '2024-01-10', loseFeriedage: 0 }] as never,
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'af-1',
          navnPaaArbejdssted: 'Arbejdssted 1',
          harOverenskomst: true,
          overenskomstId: 'bygge-anlaeg',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: 'Almindelig',
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          indtaegtsoplysningerTableData: [
            { id: 'row-1', fra: '2024-01-01', til: '2024-01-31', loen: '30000', loenperiode: 'maaned' },
          ],
        },
        {
          id: 'af-2',
          navnPaaArbejdssted: 'Arbejdssted 2',
          harOverenskomst: true,
          overenskomstId: 'bygge-anlaeg',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: 'Almindelig',
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          indtaegtsoplysningerTableData: [
            { id: 'row-2', fra: '2024-01-01', til: '2024-01-31', loen: '32000', loenperiode: 'maaned' },
          ],
        },
      ] as never,
    });

    const tafDayColumns = model.columns.filter((column) => column.id === 'base:taf_day');
    const tafReguleringColumns = model.columns.filter((column) => column.id.includes(':taf_regulering'));

    expect(tafDayColumns).toHaveLength(1);
    expect(tafDayColumns[0]?.header).toBe('TAF dag');
    expect(tafReguleringColumns).toHaveLength(2);
    expect(tafReguleringColumns[0]?.borderLeft).toBe(true);
    expect(tafReguleringColumns[1]?.borderLeft).toBe(true);
  });

  it('model med lønindkomst-rækker indeholder kolonner udover basiskolonnerne', () => {
    // Tabellen skal have loen-kolonner når der er ansaettelsesforhold med data
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'af-1',
          navnPaaArbejdssted: 'Test',
          harOverenskomst: true,
          overenskomstId: 'bygge-anlaeg',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: 'Almindelig',
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              fra: '2024-01-01',
              til: '2024-01-31',
              loen: '30000',
              loenperiode: 'maaned',
            },
          ],
        },
      ] as never,
    });
    const columnIds = model.columns.map((c) => c.id);
    const hasLoenKolonne = columnIds.some((id) => id.startsWith('loen:'));
    expect(hasLoenKolonne).toBe(true);
  });

  it('employment-kolonner viser nu underoverskrifter uden ansættelsesnummer', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'af-1',
          navnPaaArbejdssted: 'Tandlægerne Toft og Vedsted',
          harOverenskomst: true,
          overenskomstId: 'bygge-anlaeg',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: 'Almindelig',
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          indtaegtsoplysningerTableData: [
            { id: 'row-1', fra: '2024-01-01', til: '2024-01-31', loen: '30000', loenperiode: 'maaned' },
          ],
        },
      ] as never,
    });

    const employmentColumn = model.columns.find((column) => column.id === 'loen:0:taf_regulering');
    expect(employmentColumn).toBeDefined();
    expect(employmentColumn?.header).toBe('TAF-regulering');
  });

  it('employment-kolonner bruger samme underoverskrift uden fallback-navn i kolonneoverskriften', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'af-1',
          navnPaaArbejdssted: undefined,
          harOverenskomst: true,
          overenskomstId: 'bygge-anlaeg',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: 'Almindelig',
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          indtaegtsoplysningerTableData: [
            { id: 'row-1', fra: '2024-01-01', til: '2024-01-31', loen: '30000', loenperiode: 'maaned' },
          ],
        },
      ] as never,
    });

    const reguleringColumn = model.columns.find((column) => column.id === 'loen:0:taf_regulering');
    expect(reguleringColumn?.header).toBe('TAF-regulering');
  });

  it('model med offentligeYdelserRows indeholder offentlig-kolonner', () => {
    // fraDato/tilDato er i dansk format (dd-mm-åååå) — bruges af parseOffentligDato i column-builder
    // ydelsestype er registry-nøglen (lowercase), ydelse er AmountValue-objekt { kind: 'number', value }
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      offentligeYdelserRows: [
        {
          id: 'oy-1',
          ydelsestype: 'sygedagpenge',
          fraDato: '08-01-2024',
          tilDato: '12-01-2024',
          ydelse: { kind: 'number', value: 1000 },
          tillaeg: undefined,
        },
      ] as never,
    });
    const columnIds = model.columns.map((c) => c.id);
    const hasOffentligKolonne = columnIds.some((id) => id.startsWith('offentlig:'));
    expect(hasOffentligKolonne).toBe(true);
  });

  it('integrityIssues er tom ved gyldig model med lønindkomst', () => {
    const model = buildEODebugModel({
      ...base(),
      vedroererPeriodeFra: '2024-01-01' as never,
      vedroererPeriodeTil: '2024-01-31' as never,
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'af-1',
          navnPaaArbejdssted: 'Test',
          harOverenskomst: true,
          overenskomstId: 'bygge-anlaeg',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: 'Almindelig',
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          indtaegtsoplysningerTableData: [],
        },
      ] as never,
    });
    const errors = model.integrityIssues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

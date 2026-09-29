import {
  buildOffentligeYdelserReguleringTableData,
  buildOffentligeYdelserUdviklingModel,
  resolveOffentligeYdelserAkkumuleretReguleringPct,
} from '../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveReguleringssatsForAar } from '../../../domain/satser/opreguleringsmotorer';
import { formatPercent } from '../../../utils/formatUtils';
import { roundByMethod } from '../../../utils/rounding';
import { toISODateString, type ISODateString } from '../../../types/branded';
import type { IncomePeriodResult } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { OffentligeYdelserUdviklingModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import { moneyOre } from '../../../domain/money/money';

const iso = (value: string) => toISODateString(value);
const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;

const makeTableModel = (
  overrides: Partial<OffentligeYdelserUdviklingModel> = {}
): OffentligeYdelserUdviklingModel => ({
  reguleringsLabel: 'Statslig regulering per 1. januar',
  reguleringsBaseIso: iso('2022-01-01'),
  beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  entries: [{
    typeKey: 'dagpenge',
    label: 'Dagpenge',
    beregnedeSegmenter: [{
      kind: 'maaneder',
      fra: iso('2022-01-01'),
      til: iso('2022-01-31'),
      maaneder: 1,
      maanedsloenOre: moneyOre(100),
      deltaPct: 0,
      amountOre: moneyOre(100),
    }],
    total: { status: 'ok', value: moneyOre(100) },
  }],
  total: { status: 'ok', value: moneyOre(100) },
  ...overrides,
});

describe('buildOffentligeYdelserUdviklingModel regulering', () => {
  it('runder den akkumulerede reguleringsprocent til 2 decimaler før både beløb og visning', () => {
    // Akkumuleret regulering over et årsskifte har typisk >2 decimaler. Segmentets deltaPct (som
    // vises som faktor "+ X,XX %") skal være den 2-decimal-afrundede værdi, og beløbet skal regnes
    // med netop den – så brugeren kan efterregne beløbet fra den viste faktor (samme princip som løn).
    const income: IncomePeriodResult = {
      employers: [],
      benefits: [{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 12000 }],
    };
    const model = buildOffentligeYdelserUdviklingModel({
      values: { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Nej' },
      incomeForBeregningsperiode: income,
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso('2022-01-01'), til: iso('2023-12-31') }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso('2022-01-01'),
    });

    expect(model).not.toBeNull();
    const segment2023 = model?.entries[0]?.beregnedeSegmenter.find((s) => s.fra.startsWith('2023'));
    expect(segment2023).toBeDefined();
    if (!segment2023) return;

    const raw = resolveOffentligeYdelserAkkumuleretReguleringPct(2023, 2022);
    const rundet = roundByMethod(raw, 2, 'halfAwayFromZero');

    // deltaPct er 2-decimal-afrundet (ikke den rå >2-decimalers akkumulerede sats).
    expect(segment2023.deltaPct).toBe(rundet);
    expect(roundByMethod(segment2023.deltaPct, 2, 'halfAwayFromZero')).toBe(segment2023.deltaPct);
    // Bekræfter at der reelt var en divergens at rette (rå ≠ afrundet).
    expect(raw).not.toBe(rundet);
  });
});

describe('buildOffentligeYdelserReguleringTableData', () => {
  const buildModel = (fra: string, til: string, baseIso: string) => {
    const income: IncomePeriodResult = {
      employers: [],
      benefits: [{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 12000 }],
    };
    return buildOffentligeYdelserUdviklingModel({
      values: { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Nej' },
      incomeForBeregningsperiode: income,
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso(fra), til: iso(til) }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso(baseIso),
    });
  };

  it('viser den rå per-år-sats i "Regulering"-kolonnen via den delte gateway', () => {
    // Tabellens "Regulering"-kolonne skal være den enkelte års reguleringssats – netop den
    // værdi den delte fail-closed gateway (resolveReguleringssatsForAar) leverer, så beregning
    // og visning trækker på ét og samme opslag (ingen parallel rå reguleringssats[year]-sti).
    const model = buildModel('2022-01-01', '2024-12-31', '2022-01-01');
    expect(model).not.toBeNull();
    if (!model) return;

    const table = buildOffentligeYdelserReguleringTableData(model);
    expect(table).not.toBeNull();
    if (!table) return;
    expect(table.columns).toEqual(['Reguleringsdato', 'Regulering', 'Akkumuleret regulering']);
    expect(table.rows.length).toBeGreaterThan(0);

    // Base 2022 → rækker for 2023 og 2024.
    for (const row of table.rows) {
      const year = Number.parseInt(row[0].slice(-4), 10);
      const forventetRaaSats = resolveReguleringssatsForAar(year);
      expect(forventetRaaSats).toBeDefined();
      expect(row[1]).toBe(formatPercent(forventetRaaSats as number));
      expect(row[2]).toBe(formatPercent(resolveOffentligeYdelserAkkumuleretReguleringPct(year, 2022)));
    }
  });

  it('returnerer tom rows-liste når sidste segment-år ≤ baseår (ingen opregulering frem)', () => {
    const model = buildModel('2022-01-01', '2022-12-31', '2022-01-01');
    expect(model).not.toBeNull();
    if (!model) return;
    const table = buildOffentligeYdelserReguleringTableData(model);
    expect(table).not.toBeNull();
    expect(table?.rows).toEqual([]);
  });

  it('returnerer null for Ingen, manglende base eller manglende segmenter', () => {
    expect(buildOffentligeYdelserReguleringTableData(makeTableModel({ reguleringsLabel: 'Ingen' }))).toBeNull();
    expect(buildOffentligeYdelserReguleringTableData(makeTableModel({ reguleringsBaseIso: undefined }))).toBeNull();
    expect(buildOffentligeYdelserReguleringTableData(makeTableModel({ entries: [] }))).toBeNull();
  });

  it('fejler lukket når visningstabellen mangler en reguleringssats for et fremtidigt år', () => {
    const model = makeTableModel({
      entries: [{
        typeKey: 'dagpenge',
        label: 'Dagpenge',
        beregnedeSegmenter: [{
          kind: 'maaneder',
          fra: iso('2022-01-01'),
          til: iso('2100-12-31'),
          maaneder: 1,
          maanedsloenOre: moneyOre(100),
          deltaPct: 0,
          amountOre: moneyOre(100),
        }],
        total: { status: 'ok', value: moneyOre(100) },
      }],
    });

    expect(() => buildOffentligeYdelserReguleringTableData(model)).toThrow(
      'Offentlige ydelser kan ikke beregnes: reguleringssats mangler for 2027'
    );
  });
});

describe('buildOffentligeYdelserUdviklingModel', () => {
  const baseParams = (overrides: Partial<Parameters<typeof buildOffentligeYdelserUdviklingModel>[0]> = {}) => ({
    values: { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Nej' as const },
    incomeForBeregningsperiode: {
      employers: [],
      benefits: [{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 12000 }],
    },
    divisor: 1,
    tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    tafRanges: [{ fra: iso('2022-01-01'), til: iso('2022-01-31') }],
    tafArbejdsdageSet: null,
    reguler: false,
    reguleringsBaseIso: undefined,
    ...overrides,
  });

  it('returnerer null når beregningsperioden ikke indeholder ydelser', () => {
    expect(buildOffentligeYdelserUdviklingModel(baseParams({
      incomeForBeregningsperiode: { employers: [], benefits: [] },
      divisor: null,
      tafRanges: [],
    }))).toBeNull();
  });

  it('afviser manglende divisor og manglende TAF-perioder', () => {
    expect(() => buildOffentligeYdelserUdviklingModel(baseParams({ divisor: 0 }))).toThrow(
      'Offentlige ydelser kan ikke beregnes: mangler beregningsgrundlag'
    );
    expect(() => buildOffentligeYdelserUdviklingModel(baseParams({ tafRanges: [] }))).toThrow(
      'Offentlige ydelser kan ikke beregnes: TAF-perioder mangler'
    );
    expect(() => buildOffentligeYdelserUdviklingModel(baseParams({
      reguler: true,
      reguleringsBaseIso: undefined,
    }))).toThrow('Offentlige ydelser kan ikke beregnes: reguleringsdato mangler');
  });

  it('afviser runtime-ugyldig reguleringsdato', () => {
    expect(() => buildOffentligeYdelserUdviklingModel(baseParams({
      reguler: true,
      reguleringsBaseIso: invalidIso('ikke-en-dato'),
    }))).toThrow('Offentlige ydelser kan ikke beregnes: ugyldig reguleringsdato');
  });

  it('bygger et arbejdsdagssegment og springer et segment uden arbejdsdage over', () => {
    const model = buildOffentligeYdelserUdviklingModel(baseParams({
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tafRanges: [
        { fra: iso('2022-01-01'), til: iso('2022-01-02') },
        { fra: iso('2022-01-03'), til: iso('2022-01-04') },
      ],
      tafArbejdsdageSet: new Set([iso('2022-01-03')]),
    }));

    expect(model?.entries[0]?.beregnedeSegmenter).toEqual([expect.objectContaining({
      kind: 'arbejdsdage',
      fra: iso('2022-01-03'),
      til: iso('2022-01-04'),
      arbejdsdage: 1,
      amountOre: moneyOre(1200000),
    })]);
  });

  it('afviser arbejdsdagsberegning uden arbejdsdagesæt', () => {
    expect(() => buildOffentligeYdelserUdviklingModel(baseParams({
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
    }))).toThrow('Offentlige ydelser kan ikke beregnes: arbejdsdagegrundlag mangler');
  });

  it('runder midlertidigt EET til hele kroner når togglen er aktiv', () => {
    const model = buildOffentligeYdelserUdviklingModel(baseParams({
      values: { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Ja' },
      incomeForBeregningsperiode: {
        employers: [],
        benefits: [{ typeKey: 'midlertidigt_eet', label: 'Midlertidigt EET', amount: 10.555 }],
      },
    }));

    expect(model?.entries[0]?.beregnedeSegmenter[0]?.amountOre).toBe(moneyOre(1100));
  });
});

describe('resolveOffentligeYdelserAkkumuleretReguleringPct', () => {
  it('fejler lukket når den valgte periode mangler en reguleringssats', () => {
    expect(() => resolveOffentligeYdelserAkkumuleretReguleringPct(1900, 1900)).toThrow(
      'Offentlige ydelser kan ikke beregnes: reguleringssats mangler for 1900'
    );
  });
});

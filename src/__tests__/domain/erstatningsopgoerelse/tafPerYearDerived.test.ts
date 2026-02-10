import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildErstatningsopgoerelsePdfModel } from '../../../domain/erstatningsopgoerelse/eoPdfModel';
import {
  splitRangeByCalendarYearsInclusive,
  buildTafPerYearResult,
} from '../../../domain/erstatningsopgoerelse/tafPerYearDerived';

const iso = (value: string) => toISODateString(value);

const initialEoValues = createErstatningsopgoerelseInitialValues();

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(initialEoValues);
  return {
    ...base,
    ...patch,
    eoAngivetLoenLoenudvikling: {
      ...base.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen',
      ...patch.eoAngivetLoenLoenudvikling,
    },
  };
};

const makeStamdata = (patch: Partial<StamdataValues>): StamdataValues => {
  const base = structuredClone(STAMDATA_INITIAL_VALUES);
  return { ...base, ...patch };
};

const dagsDatoISO = iso('2026-02-04');

// ─── splitRangeByCalendarYearsInclusive ──────────────────────────────────

describe('splitRangeByCalendarYearsInclusive', () => {
  it('range inden for ét år → 1 sub-range', () => {
    const result = splitRangeByCalendarYearsInclusive(iso('2024-03-15'), iso('2024-09-20'));
    expect(result).toEqual([
      { fra: '2024-03-15', til: '2024-09-20', year: 2024 },
    ]);
  });

  it('range 2024-10-01 → 2025-01-10 → 2 sub-ranges', () => {
    const result = splitRangeByCalendarYearsInclusive(iso('2024-10-01'), iso('2025-01-10'));
    expect(result).toEqual([
      { fra: '2024-10-01', til: '2024-12-31', year: 2024 },
      { fra: '2025-01-01', til: '2025-01-10', year: 2025 },
    ]);
  });

  it('range 2023-06-22 → 2025-05-31 → 3 sub-ranges', () => {
    const result = splitRangeByCalendarYearsInclusive(iso('2023-06-22'), iso('2025-05-31'));
    expect(result).toEqual([
      { fra: '2023-06-22', til: '2023-12-31', year: 2023 },
      { fra: '2024-01-01', til: '2024-12-31', year: 2024 },
      { fra: '2025-01-01', til: '2025-05-31', year: 2025 },
    ]);
  });

  it('grænsetest: 2024-12-31 → 2025-01-01 → 2 sub-ranges med 1 dag hver', () => {
    const result = splitRangeByCalendarYearsInclusive(iso('2024-12-31'), iso('2025-01-01'));
    expect(result).toEqual([
      { fra: '2024-12-31', til: '2024-12-31', year: 2024 },
      { fra: '2025-01-01', til: '2025-01-01', year: 2025 },
    ]);
  });
  it('fra > til kaster fejl', () => {
    expect(() => splitRangeByCalendarYearsInclusive(iso('2025-01-01'), iso('2024-12-31'))).toThrow();
  });

  it('samme dag → 1 sub-range', () => {
    const result = splitRangeByCalendarYearsInclusive(iso('2024-06-15'), iso('2024-06-15'));
    expect(result).toEqual([
      { fra: '2024-06-15', til: '2024-06-15', year: 2024 },
    ]);
  });

  it('5 år → 5 sub-ranges', () => {
    const result = splitRangeByCalendarYearsInclusive(iso('2020-01-01'), iso('2024-12-31'));
    expect(result).toHaveLength(5);
    expect(result[0].year).toBe(2020);
    expect(result[4].year).toBe(2024);
    // Ingen huller: hvert sub-range slutter 12-31, næste starter 01-01
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].til.endsWith('-12-31')).toBe(true);
      expect(result[i].fra.endsWith('-01-01')).toBe(true);
    }
  });
});

// ─── buildTafPerYearResult ────────────────────────────────────────

describe('buildTafPerYearResult', () => {
  /**
   * Invariant: sum(yearTafOre) + afrundingOre === samletTafKravOre
   * Tjekkes i alle tests der returnerer et resultat.
   */
  const assertInvariant = (result: NonNullable<ReturnType<typeof buildTafPerYearResult>>) => {
    const sum = result.years.reduce((s, y) => s + y.yearTafOre, 0);
    expect(sum).toBe(result.sumYearTafOre);
    expect(result.sumYearTafOre + result.afrundingOre).toBe(result.samletTafKravOre);
  };

  it('returnerer null for model uden loenudvikling', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      beregnesTabtArbejdsfortjeneste: 'Nej',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).toBeNull();
  });

  it('segment inden for ét år → ingen splitting, korrekt TAF', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-02'), til: iso('2024-01-04'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '02-01-2024', tilDato: '04-01-2024', ydelse: asAmountValue(100), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years).toHaveLength(1);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[0].segments.length).toBeGreaterThan(0);
    expect(result.years[0].segments[0].kind).toBe('arbejdsdage');
  });

  it('segment der krydser kalenderår → splittes korrekt', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(2000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '01-12-2024', tilDato: '31-01-2025', ydelse: asAmountValue(100), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years).toHaveLength(2);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[1].year).toBe(2025);

    // Begge år skal have segmenter
    expect(result.years[0].segments.length).toBeGreaterThan(0);
    expect(result.years[1].segments.length).toBeGreaterThan(0);

    // Samlet quantity skal matche original segment quantity
    const totalQuantity = result.years.reduce(
      (sum, y) => sum + y.segments.reduce((s, seg) => s + seg.quantity, 0),
      0
    );
    const modelSegment = model.tabtArbejdsfortjeneste.loenudvikling!.beregnedeSegmenter[0];
    expect(totalQuantity).toBe(
      modelSegment.kind === 'arbejdsdage' ? modelSegment.arbejdsdage : modelSegment.maaneder
    );
  });

  it('fradrag fordeles korrekt per år', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-12-2024',
          tilDato: '31-01-2025',
          ydelse: asAmountValue(5000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);

    // Begge år har fradrag (sygedagpenge strækker over begge)
    const deductionYears = result.years.filter((y) => y.deductions.length > 0);
    expect(deductionYears.length).toBeGreaterThanOrEqual(1);

    // Total deductions skal matche EO-model (pga. proratering)
    const totalDeductionsOre = result.years.reduce((sum, y) => sum + y.yearDeductionsOre, 0);
    expect(totalDeductionsOre).toBeGreaterThan(0);
  });

  it('invariant: sum(yearTafOre) + afrundingOre === samletTafKravOre med flere segmenter', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1234.56),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2023-06-22'), til: iso('2025-05-31'), loseFeriedage: 3 },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '22-06-2023',
          tilDato: '31-05-2025',
          ydelse: asAmountValue(8000),
          tillaeg: asAmountValue(500),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-06-22') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years.length).toBe(3);
    expect(result.years[0].year).toBe(2023);
    expect(result.years[1].year).toBe(2024);
    expect(result.years[2].year).toBe(2025);
  });

  it('måneds-baseret TAF over kalenderårsskift', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-11-01'), til: iso('2025-02-28'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '01-11-2024', tilDato: '28-02-2025', ydelse: asAmountValue(100), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years).toHaveLength(2);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[1].year).toBe(2025);
    expect(result.years[0].segments[0].kind).toBe('maaneder');
    expect(result.years[1].segments[0].kind).toBe('maaneder');
  });

  it('fradrag kun i ét af to år → det andet år har yearDeductionsOre = 0', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(2000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined },
      ],
      // Ydelse kun i 2024 → 2025 har ingen fradrag
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '01-12-2024', tilDato: '31-12-2024', ydelse: asAmountValue(100), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years).toHaveLength(2);
    // 2024 har fradrag
    expect(result.years[0].deductions.length).toBeGreaterThan(0);
    // 2025 har ingen fradrag
    expect(result.years[1].deductions).toHaveLength(0);
    expect(result.years[1].yearDeductionsOre).toBe(0);
    expect(result.years[1].yearTafOre).toBe(result.years[1].yearIncomeOre);
  });

  it('segment ved årsskifte → begge år dækkes når begge har arbejdsdage', () => {
    // 30-12-2024 (mandag) → 02-01-2025 (torsdag)
    // 31/12 er tirsdag (arbejdsdag), 01/01 er helligdag, 02/01 er torsdag (arbejdsdag)
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(3000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-30'), til: iso('2025-01-03'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '30-12-2024', tilDato: '03-01-2025', ydelse: asAmountValue(50), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years).toHaveLength(2);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[1].year).toBe(2025);
  });

  it('ét segment splittet i 3+ år → alle år dækkes, invariant holder', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2020-06-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '01-06-2020', tilDato: '31-12-2024', ydelse: asAmountValue(500), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2020-06-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years.length).toBe(5);
    expect(result.years.map((y) => y.year)).toEqual([2020, 2021, 2022, 2023, 2024]);
  });

  it('kun måneder, ingen arbejdsdage → korrekt split og invariant', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(25000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2023-10-01'), til: iso('2025-03-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '01-10-2023', tilDato: '31-03-2025', ydelse: asAmountValue(200), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-10-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years.length).toBe(3);
    for (const year of result.years) {
      expect(year.segments.every((s) => s.kind === 'maaneder')).toBe(true);
    }
  });

  it('meget lille TAF-beløb → afrunding er håndterbar', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(10),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-30'), til: iso('2025-01-02'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '30-12-2024', tilDato: '02-01-2025', ydelse: asAmountValue(1), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    // Afrunding bør ikke dominere beløbet (max ±100 øre = 1 kr.)
    expect(Math.abs(result.afrundingOre)).toBeLessThanOrEqual(100);
  });

  it('stort beløb + mange år → akkumuleret afrunding forbliver lille', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(4567.89),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2020-03-15'), til: iso('2025-11-30'), loseFeriedage: 5 },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '15-03-2020', tilDato: '30-11-2025', ydelse: asAmountValue(12000), tillaeg: asAmountValue(1500), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2020-03-15') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years.length).toBe(6);
    // Med 6 år og individuel afrunding bør samlet afrunding holde sig under 10 kr. (1000 øre)
    expect(Math.abs(result.afrundingOre)).toBeLessThanOrEqual(1000);
  });

  it('segment der starter og slutter samme dag (hverdag) → 1 år, 1 segment', () => {
    // 17. juni 2024 er en mandag
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(2000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-06-17'), til: iso('2024-06-17'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '17-06-2024', tilDato: '17-06-2024', ydelse: asAmountValue(50), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    expect(result.years).toHaveLength(1);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[0].segments).toHaveLength(1);
    expect(result.years[0].segments[0].quantity).toBe(1);
  });

  it('år med fradrag men 0 segmenter inkluderes (helligdag-kun-år)', () => {
    // TAF-periode 31-12-2024 → 01-01-2025
    // 31/12 er en tirsdag (arbejdsdag i 2024)
    // 01/01 er nytårsdag (helligdag → 0 arbejdsdage i 2025)
    // Ydelse dækker begge dage → 2025 har fradrag men ingen segmenter
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(3000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-31'), til: iso('2025-01-01'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '31-12-2024', tilDato: '01-01-2025', ydelse: asAmountValue(500), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);
    // 2025 skal inkluderes selvom der er 0 segmenter, fordi TAF-range dækker 01-01-2025
    expect(result.years).toHaveLength(2);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[1].year).toBe(2025);
    // 2024 har 1 arbejdsdag (31/12)
    expect(result.years[0].segments.length).toBe(1);
    expect(result.years[0].segments[0].quantity).toBe(1);
    // 2025 har 0 segmenter men kan have fradrag
    expect(result.years[1].segments).toHaveLength(0);
    expect(result.years[1].yearIncomeOre).toBe(0);
  });

  it('sub-segmenter har ingen overlap eller huller per originalt segment', () => {
    // Et enkelt originalt segment der krydser 3 kalenderår
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2023-06-22'), til: iso('2025-05-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '22-06-2023', tilDato: '31-05-2025', ydelse: asAmountValue(100), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-06-22') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearResult(model, eoValues);
    expect(result).not.toBeNull();
    if (!result) return;

    assertInvariant(result);

    // Saml alle sub-segmenter på tværs af år, sorteret efter fra
    const allSubs = result.years.flatMap((y) => y.segments).sort((a, b) => (a.fra < b.fra ? -1 : 1));
    expect(allSubs.length).toBeGreaterThanOrEqual(3);

    // Ingen overlap: hvert segments fra skal være > forrige segments til
    for (let i = 1; i < allSubs.length; i++) {
      expect(allSubs[i].fra > allSubs[i - 1].til).toBe(true);
    }

    // Ingen huller: hvert segments fra skal være dagen efter forrige segments til
    // (da de er splittet ved 12-31/01-01 grænser)
    for (let i = 1; i < allSubs.length; i++) {
      const prevTil = new Date(allSubs[i - 1].til + 'T00:00:00Z');
      const nextFra = new Date(allSubs[i].fra + 'T00:00:00Z');
      const daysBetween = (nextFra.getTime() - prevTil.getTime()) / (1000 * 60 * 60 * 24);
      // Præcis 1 dag mellem (forrige til er 12-31, næste fra er 01-01)
      expect(daysBetween).toBe(1);
    }
  });

  it('stabilitet: samme input → samme output', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-06-01'), til: iso('2025-03-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-06-2024',
          tilDato: '31-03-2025',
          ydelse: asAmountValue(3000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Kontanthjælp',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...initialEoValues.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model1 = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });
    const result1 = buildTafPerYearResult(model1, eoValues);

    const model2 = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });
    const result2 = buildTafPerYearResult(model2, eoValues);

    expect(result1).toEqual(result2);
  });
});

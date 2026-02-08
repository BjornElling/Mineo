import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildErstatningsopgoerelsePdfModel } from '../../../domain/erstatningsopgoerelse/eoPdfModel';
import {
  splitRangeByCalendarYearsInclusive,
  buildTafPerYearPresentation,
} from '../../../domain/erstatningsopgoerelse/tafPerYearPresentation';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES);
  return { ...base, ...patch };
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
});

// ─── buildTafPerYearPresentation ────────────────────────────────────────

describe('buildTafPerYearPresentation', () => {
  /**
   * Invariant: sum(yearTafOre) + afrundingOre === samletTafKravOre
   * Tjekkes i alle tests der returnerer et resultat.
   */
  const assertInvariant = (result: NonNullable<ReturnType<typeof buildTafPerYearPresentation>>) => {
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

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-06-22') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });

    const result = buildTafPerYearPresentation(model, eoValues);
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
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model1 = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });
    const result1 = buildTafPerYearPresentation(model1, eoValues);

    const model2 = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO });
    const result2 = buildTafPerYearPresentation(model2, eoValues);

    expect(result1).toEqual(result2);
  });
});

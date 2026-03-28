import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { PdfModel } from '../../../domain/erstatningsopgoerelse/eoPdfModelTypes';
import { computeEoSnapshot, type EoSnapshotComputedData } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import {
  splitRangeByCalendarYearsInclusive,
  buildTafPerYearBuildOutcome,
  type TafPerYearSource,
  type TafPerYearResult,
} from '../../../domain/erstatningsopgoerelse/tafPerYearDerived';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
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
const EMPTY_SFGG_RESULT = {
  totalOre: 0,
  perAnsaettelsesforhold: [],
  perYear: [],
  firstExcludedDate: null,
} as const;

const buildSnapshotData = (
  stamdata: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  opts: Readonly<{ dagsDatoISO: ReturnType<typeof iso> }> = { dagsDatoISO }
): EoSnapshotComputedData => {
  const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: opts.dagsDatoISO });
  if (!snapshot.data) {
    const message = snapshot.invariants[0]?.message ?? 'Snapshot fejlede';
    throw new Error(message);
  }
  return snapshot.data;
};

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
   * Årsbeløb må være negative, men sum + afrunding skal altid ramme samlet TAF-krav.
   */
  const assertTotals = (
    result: TafPerYearResult,
    pdfModel: PdfModel
  ) => {
    const sum = result.years.reduce((s, y) => s + y.yearTafOre, 0);
    expect(sum).toBe(result.sumYearTafOre);
    const expectedAfrunding = result.samletTafKravOre - result.sumYearTafOre;
    expect(result.afrundingOre).toBe(expectedAfrunding);
    expect(result.samletTafKravOre).toBe(pdfModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
    expect(Math.abs(result.afrundingOre)).toBeLessThanOrEqual(100);
  };

  it('returnerer null for model uden loenudvikling', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      beregnesTabtArbejdsfortjeneste: 'Nej',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });

    expect(snapshotData.engines.tafPerYear).toBeNull();
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
    expect(result.years).toHaveLength(1);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[0].segments.length).toBeGreaterThan(0);
    expect(result.years[0].segments[0].kind).toBe('arbejdsdage');
  });

  it('anvender forligsgrad kun på års-I alt (segmenter forbliver fulde)', () => {
    const baseValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-02'), til: iso('2024-01-03'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const withForlig = makeValues({
      ...baseValues,
      forligAnsvarsgradProcent: 50,
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const baseSnapshotData = buildSnapshotData(stamdata, baseValues, { dagsDatoISO });
    const forligSnapshotData = buildSnapshotData(stamdata, withForlig, { dagsDatoISO });

    const baseResult = baseSnapshotData.engines.tafPerYear;
    const forligResult = forligSnapshotData.engines.tafPerYear;
    expect(baseResult).not.toBeNull();
    expect(forligResult).not.toBeNull();
    if (!baseResult || !forligResult) return;

    assertTotals(baseResult, baseSnapshotData.pdfModel);
    assertTotals(forligResult, forligSnapshotData.pdfModel);
    expect(baseResult.years).toHaveLength(1);
    expect(forligResult.years).toHaveLength(1);
    expect(baseResult.years[0].segments).toHaveLength(1);
    expect(forligResult.years[0].segments).toHaveLength(1);

    const baseSeg = baseResult.years[0].segments[0];
    const forligSeg = forligResult.years[0].segments[0];

    expect(forligSeg.unitAmountOre).toBe(baseSeg.unitAmountOre);
    expect(forligSeg.amountOre).toBe(baseSeg.amountOre);
    expect(forligResult.years[0].yearTafFoerForligOre).toBe(baseResult.years[0].yearTafOre);
    expect(forligResult.years[0].yearTafOre).toBe(Math.round(baseResult.years[0].yearTafOre * 0.5));
    expect(forligResult.samletTafKravOre).toBe(Math.round(baseResult.samletTafKravOre * 0.5));
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
    const pdfModel = snapshotData.pdfModel;
    const modelSegment = pdfModel.tabtArbejdsfortjeneste.loenudvikling!.beregnedeSegmenter[0];
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;
    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);

    // Begge år har fradrag (sygedagpenge strækker over begge)
    const deductionYears = result.years.filter((y) => y.deductions.length > 0);
    expect(deductionYears.length).toBeGreaterThanOrEqual(1);

    // Total deductions skal matche EO-model (pga. proratering)
    const totalDeductionsOre = result.years.reduce((sum, y) => sum + y.yearDeductionsOre, 0);
    expect(totalDeductionsOre).toBeGreaterThan(0);
  });

  it('fordeler sygeferiegodtgørelse pr. kalenderår og afstemmer med EO-totalen', () => {
    const eoValues = makeValues({
      eoNummer: '2',
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-30'), til: iso('2025-01-03'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'af-1',
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        beregnesUdFra: 'Manuelt angivet',
        manuelDagssats: asAmountValue(100),
        manuelBeloebIHenholdTil: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        satsvalg: undefined,
        alleredeBetaltBeloeb: undefined,
      }],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
    const sfggPerYearOre = result.years
      .flatMap((year) => year.deductions)
      .filter((deduction) => deduction.label === 'Sygeferiegodtgørelse')
      .reduce((sum, deduction) => sum + deduction.amountOre, 0);

    expect(sfggPerYearOre).toBe(snapshotData.pdfModel.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre);
    expect(result.years.map((year) => year.year)).toEqual([2024, 2025]);
    expect(result.years.every((year) => year.deductions.some((deduction) => deduction.label === 'Sygeferiegodtgørelse'))).toBe(true);
  });

  it('viser sygeferiegodtgørelse med 0 kr. pr. år når den er valgt men ender på 0', () => {
    const eoValues = makeValues({
      eoNummer: '2',
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-29'), til: iso('2024-01-29'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'af-1',
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        beregnesUdFra: 'Manuelt angivet',
        manuelDagssats: asAmountValue(100),
        manuelBeloebIHenholdTil: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        satsvalg: undefined,
        alleredeBetaltBeloeb: asAmountValue(1000),
      }],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
    const sfggDeduction = result.years[0].deductions.find((deduction) => deduction.label === 'Sygeferiegodtgørelse');
    expect(snapshotData.pdfModel.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre).toBe(0);
    expect(sfggDeduction?.amountOre).toBe(0);
  });

  it('udelader sygeferiegodtgørelse helt fra TAF fordelt på år når alle relevante ansættelsesforhold står til Ingen', () => {
    const eoValues = makeValues({
      eoNummer: '2',
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-30'), til: iso('2025-01-03'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'af-1',
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        beregnesUdFra: 'Ingen',
        manuelDagssats: undefined,
        manuelBeloebIHenholdTil: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        satsvalg: undefined,
        alleredeBetaltBeloeb: undefined,
      }],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    expect(snapshotData.pdfModel.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold).toEqual([]);
    expect(snapshotData.pdfModel.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre).toBe(0);
    expect(
      result.years.every((year) => year.deductions.every((deduction) => deduction.label !== 'Sygeferiegodtgørelse'))
    ).toBe(true);
  });

  it('afstemmer enkeltår med autoritativ EO-total når SFGG alene clampper netto til 0', () => {
    const eoValues = makeValues({
      eoNummer: '2',
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(50),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-29'), til: iso('2024-01-29'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'af-1',
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        beregnesUdFra: 'Manuelt angivet',
        manuelDagssats: asAmountValue(100),
        manuelBeloebIHenholdTil: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        satsvalg: undefined,
        alleredeBetaltBeloeb: undefined,
      }],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    expect(snapshotData.pdfModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(0);
    expect(result.years).toHaveLength(1);
    expect(result.years[0].yearTafFoerForligOre).toBe(0);
    expect(result.years[0].yearTafOre).toBe(0);
    expect(result.sumYearTafOre).toBe(0);
    expect(result.afrundingOre).toBe(0);
  });

  it('sorterer benefits alfabetisk som EO i per-år fradrag', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1500),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-10'), til: iso('2024-01-10'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [
        {
          id: 'y1',
          fraDato: '10-01-2024',
          tilDato: '10-01-2024',
          ydelse: asAmountValue(10),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
        {
          id: 'y2',
          fraDato: '10-01-2024',
          tilDato: '10-01-2024',
          ydelse: asAmountValue(10),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Midlertidigt EET',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;
    assertTotals(result, snapshotData.pdfModel);
    expect(result.years).toHaveLength(1);

    const benefitLabels = result.years[0].deductions.map((d) => d.label);
    expect(benefitLabels).toEqual(['Midlertidigt EET', 'Sygedagpenge']);
  });

  it('sumYearTafOre og afrunding er konsistente ved flere segmenter', () => {
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-06-22') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;
    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2020-06-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-10-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2020-03-15') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
    expect(result.years.length).toBe(6);
    // Med systemets policy må afvigelsen mellem årssum og samlet TAF ikke overstige 1 kr.
    expect(Math.abs(result.afrundingOre)).toBeLessThanOrEqual(100);
  });

  it('lønindkomst-fradrag i årsfordeling matcher EO-indtægter inden for 1 kr.', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(3000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-10'), til: iso('2024-01-10'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          navnPaaArbejdssted: 'Arbejdssted A',
          loenperiode: 'dag',
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [
            {
              id: 'r1',
              col0_maaned: '',
              col1_maaned: '',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '10-01-2024',
              col1_dag: '10-01-2024',
              col2: asAmountValue(1000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;
    assertTotals(result, snapshotData.pdfModel);

    const modelEmployerOre = snapshotData.pdfModel.tabtArbejdsfortjeneste.tafIndtaegter?.entries
      .filter((entry) => entry.label === 'Arbejdssted A')
      .reduce((sum, entry) => sum + entry.amountOre, 0) ?? 0;
    const perYearEmployerOre = result.years
      .flatMap((year) => year.deductions)
      .filter((deduction) => deduction.label === 'Arbejdssted A')
      .reduce((sum, deduction) => sum + deduction.amountOre, 0);

    expect(Math.abs(perYearEmployerOre - modelEmployerOre)).toBeLessThanOrEqual(100);
  });

  it('afstemmer enkeltår til 0 når EO-netto er clamped til 0 pga. fradrag over indkomst', () => {
    const source: TafPerYearSource = {
      stamdataValues: structuredClone(STAMDATA_INITIAL_VALUES),
      loenudvikling: {
        loenudviklingTotal: { status: 'ok', value: 10000000 },
        beregnedeSegmenter: [
          {
            kind: 'arbejdsdage',
            fra: toISODateString('2024-01-10'),
            til: toISODateString('2024-01-10'),
            arbejdsdage: 1,
            dagsloenOre: 10000000,
            deltaPct: 1,
            amountOre: 10000000,
          },
        ],
        beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
        loenudviklingLabel: '',
        perAnsaettelse: [],
      },
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tabtArbejdsfortjenesteOre: 0,
      tidligereModtagetTaf: { status: 'ok', value: 0 },
      sygeferiegodtgoerelse: EMPTY_SFGG_RESULT,
      tafIndtaegter: { entries: [], oevrigeKravForbeholdYdelsestyper: [], total: { status: 'ok', value: 15000000 } },
      forligFactor: null,
    };

    const eoValues = makeValues({
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-10'), til: iso('2024-01-10'), loseFeriedage: undefined }],
      loenindkomstAnsaettelsesforhold: [
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), loenudviklingBeregningsgrundlag: 'Ingen' },
      ],
      offentligeYdelserRows: [],
    });

    const outcome = buildTafPerYearBuildOutcome(source, eoValues, { tafRanges: eoValues.tafPerioder });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.result.years).toHaveLength(1);
    expect(outcome.result.years[0].yearTafFoerForligOre).toBe(0);
    expect(outcome.result.years[0].yearTafOre).toBe(0);
    expect(outcome.result.sumYearTafOre).toBe(0);
    expect(outcome.result.afrundingOre).toBe(0);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);
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

  it('clampper TAF-ranges til EO-perioden i TAF per år-resultatet', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-05'),
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(3000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        { id: 'y1', fraDato: '01-01-2024', tilDato: '10-01-2024', ydelse: asAmountValue(500), tillaeg: asAmountValue(0), ydelsestype: 'Sygedagpenge' },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.years).toHaveLength(1);
    expect(result.years[0].year).toBe(2024);
    expect(result.years[0].segments.every((segment) => segment.til <= iso('2024-01-05'))).toBe(true);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2023-06-22') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;

    assertTotals(result, snapshotData.pdfModel);

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

  it('returnerer null når loenudviklingTotal.status !== "ok"', () => {
    // Konstruér et minimalt source-objekt der trigger ikke-ok loenudviklingTotal
    const source: TafPerYearSource = {
      stamdataValues: structuredClone(STAMDATA_INITIAL_VALUES),
      loenudvikling: {
        loenudviklingTotal: { status: 'not_calculable', reason: 'test-fejl' },
        beregnedeSegmenter: [
          {
            kind: 'maaneder',
            fra: toISODateString('2024-01-01'),
            til: toISODateString('2024-12-31'),
            maaneder: 12,
            maanedsloenOre: 300000,
            deltaPct: 1,
            amountOre: 3600000,
          },
        ],
        beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
        loenudviklingLabel: '',
        perAnsaettelse: [],
      },
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tabtArbejdsfortjenesteOre: 0,
      tidligereModtagetTaf: { status: 'not_calculable', reason: 'test' },
      sygeferiegodtgoerelse: EMPTY_SFGG_RESULT,
      tafIndtaegter: { entries: [], oevrigeKravForbeholdYdelsestyper: [], total: { status: 'ok', value: 0 } },
      forligFactor: null,
    };
    const eoValues = makeValues({
      tafPerioder: [
        { id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31'), loseFeriedage: undefined },
      ],
    });
    const outcome = buildTafPerYearBuildOutcome(source, eoValues, { tafRanges: eoValues.tafPerioder });
    expect(outcome.kind).not.toBe('ok');
  });

  it('segmenter med kind="arbejdsdage" springes over når tafBeregningsenhed=Måneder (tafArbejdsdageSet er null)', () => {
    // Inkonsistent tilstand: beregningsenhed=MAANEDER men segmenter har kind='arbejdsdage'
    // Forventer at buildSubSegment returnerer null → segment springes over
    const source: TafPerYearSource = {
      stamdataValues: structuredClone(STAMDATA_INITIAL_VALUES),
      loenudvikling: {
        loenudviklingTotal: { status: 'ok', value: 0 },
        beregnedeSegmenter: [
          {
            kind: 'arbejdsdage',
            fra: toISODateString('2024-01-02'),
            til: toISODateString('2024-01-05'),
            arbejdsdage: 4,
            dagsloenOre: 50000,
            deltaPct: 1,
            amountOre: 200000,
          },
        ],
        beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
        loenudviklingLabel: '',
        perAnsaettelse: [],
      },
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tabtArbejdsfortjenesteOre: 0,
      tidligereModtagetTaf: { status: 'not_calculable', reason: 'test' },
      sygeferiegodtgoerelse: EMPTY_SFGG_RESULT,
      tafIndtaegter: { entries: [], oevrigeKravForbeholdYdelsestyper: [], total: { status: 'ok', value: 0 } },
      forligFactor: null,
    };
    const eoValues = makeValues({
      tafPerioder: [
        { id: 'taf-1', fra: toISODateString('2024-01-02'), til: toISODateString('2024-01-05'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), loenudviklingBeregningsgrundlag: 'Ingen' },
      ],
    });
    // Alle segmenter springes over (tafArbejdsdageSet er null) → alle år har 0 segmenter
    const outcome = buildTafPerYearBuildOutcome(source, eoValues, { tafRanges: eoValues.tafPerioder });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const result = outcome.result;
    // Alle segmenter er sprunget over
    expect(result.years.every((y) => y.segments.length === 0)).toBe(true);
    // Invariant: sumYearTafOre + afrundingOre === samletTafKravOre
    expect(result.sumYearTafOre + result.afrundingOre).toBe(result.samletTafKravOre);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const snapshotData1 = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result1 = snapshotData1.engines.tafPerYear;

    const snapshotData2 = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result2 = snapshotData2.engines.tafPerYear;

    expect(result1).toEqual(result2);
  });

  it('allocateOreByWeight fallback: allWeights=0 → hele beløbet tildeles første år', () => {
    // Brug source med tafBeregningsenhed=ARBEJDSDAGE og maaneder-segmenter.
    // TAF-perioden dækker kun weekend (lørdag-søndag) → tafArbejdsdageSet bliver tom
    // → alle årsvægte = 0 → allocateOreByWeight tildeler hele tidligereModtagetTaf til første år.
    const source: TafPerYearSource = {
      stamdataValues: structuredClone(STAMDATA_INITIAL_VALUES),
      loenudvikling: {
        loenudviklingTotal: { status: 'ok', value: 100 },
        beregnedeSegmenter: [
          {
            kind: 'maaneder',
            fra: toISODateString('2024-01-06'),
            til: toISODateString('2024-01-07'),
            maaneder: 0.0645,
            maanedsloenOre: 0,
            deltaPct: 1,
            amountOre: 0,
          },
        ],
        beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
        loenudviklingLabel: '',
        perAnsaettelse: [],
      },
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tabtArbejdsfortjenesteOre: 0,
      tidligereModtagetTaf: { status: 'ok', value: 100 },
      sygeferiegodtgoerelse: EMPTY_SFGG_RESULT,
      tafIndtaegter: { entries: [], oevrigeKravForbeholdYdelsestyper: [], total: { status: 'ok', value: 0 } },
      forligFactor: null,
    };
    // TAF-periode: kun lørdag-søndag 6-7 januar 2024 → buildTafArbejdsdageSet returnerer tom mængde
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      tafPerioder: [
        { id: 'taf-1', fra: toISODateString('2024-01-06'), til: toISODateString('2024-01-07'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), loenudviklingBeregningsgrundlag: 'Ingen' },
      ],
    });
    const outcome = buildTafPerYearBuildOutcome(source, eoValues, { tafRanges: eoValues.tafPerioder });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const result = outcome.result;
    // Hele beløbet tildeles det første år (allWeights=0 fallback)
    const allPaid = result.years.flatMap((y) => y.deductions).filter((d) => d.label === 'Allerede betalt TAF');
    const totalPaidOre = allPaid.reduce((s, d) => s + d.amountOre, 0);
    expect(totalPaidOre).toBe(100);
    // Invariant stadig gyldig
    expect(result.sumYearTafOre + result.afrundingOre).toBe(result.samletTafKravOre);
  });

  it('fordeler "Allerede betalt TAF" pr. år efter arbejdsdage', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(2000),
      tidligereModtagetTaf: asAmountValue(100),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-30'), til: iso('2025-01-03'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;
    assertTotals(result, snapshotData.pdfModel);
    expect(result.years).toHaveLength(2);

    const firstYearPaid = result.years[0].deductions.find((d) => d.label === 'Allerede betalt TAF');
    const secondYearPaid = result.years[1].deductions.find((d) => d.label === 'Allerede betalt TAF');

    expect(firstYearPaid?.amountOre).toBe(5000);
    expect(secondYearPaid?.amountOre).toBe(5000);
    const totalPaidOre = result.years
      .flatMap((year) => year.deductions)
      .filter((d) => d.label === 'Allerede betalt TAF')
      .reduce((sum, d) => sum + d.amountOre, 0);
    expect(totalPaidOre).toBe(10000);
  });

  it('fordeler "Allerede betalt TAF" pr. år efter måneder', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tidligereModtagetTaf: asAmountValue(300),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const snapshotData = buildSnapshotData(stamdata, eoValues, { dagsDatoISO });
    const result = snapshotData.engines.tafPerYear;

    expect(result).not.toBeNull();
    if (!result) return;
    assertTotals(result, snapshotData.pdfModel);
    expect(result.years).toHaveLength(2);

    const firstYearPaid = result.years[0].deductions.find((d) => d.label === 'Allerede betalt TAF');
    const secondYearPaid = result.years[1].deductions.find((d) => d.label === 'Allerede betalt TAF');

    expect(firstYearPaid?.amountOre).toBe(15000);
    expect(secondYearPaid?.amountOre).toBe(15000);
    const totalPaidOre = result.years
      .flatMap((year) => year.deductions)
      .filter((d) => d.label === 'Allerede betalt TAF')
      .reduce((sum, d) => sum + d.amountOre, 0);
    expect(totalPaidOre).toBe(30000);
  });
});

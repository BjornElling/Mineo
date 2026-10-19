import {
  allocateOreByWeights,
  buildEligibleDatesForSfggRange,
  buildEmploymentSfggCalculator,
  buildSfggGrossOre,
  buildYearAllocationsForGroupedSegment,
  resolveSfggSegmentBoundaryStarts,
  resolveSfggSegmentRateForDate,
} from '../../../domain/erstatningsopgoerelse/engines/sfggSegmentering';
import { moneyOre, toKroner } from '../../../domain/money/money';
import { buildReguleringsbevis } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringsbevis';
import {
  asSfggAmount,
  createSfggEmployment,
  createSfggIngenRow,
  sfggIso as iso,
  sfggReguleringOpslagFraSegmenter,
} from '../../utils/sfggTestSupport';

describe('sfggSegmentering', () => {
  it('måler manuel regulering fra basisniveau ved en ældre reference og afviser manglende kildedækning', () => {
    const opslag = sfggReguleringOpslagFraSegmenter([{
      kind: 'maaneder', fra: iso('2024-01-01'), til: iso('2024-12-31'), maaneder: 12,
      maanedsloenOre: moneyOre(300_000), deltaPct: 10, amountOre: moneyOre(3_960_000),
    }], { dato: iso('2023-12-01'), deltaPct: 0 });
    const args = {
      iso: iso('2024-06-01'), employment: createSfggEmployment(), sfggRow: createSfggIngenRow('af-1'),
      sfggSource: { kind: 'ferielov' as const },
      sfggBaseRate: {
        sfggReferenceperiode: { fra: iso('2022-01-01'), til: iso('2022-01-31') },
        sfggReferencesatsOre: { status: 'ok' as const, value: moneyOre(25_000) },
        sfggReferencesatsFormula: null,
      },
    };
    expect(resolveSfggSegmentRateForDate({ ...args, reguleringOpslag: { ...opslag, manuelBasisDato: iso('2023-12-01') } }))
      .toMatchObject({ satsOre: 27_500, reguleringsindeks: 110, reguleringsgrundlag: { referenceValue: 100, periodValue: 110 } });
    expect(() => resolveSfggSegmentRateForDate({ ...args, reguleringOpslag: opslag }))
      .toThrow('Regulering kan ikke beregnes for 2022-01-31');
    // Manuel SFGG-sats er konstant, også når den valgte lønregulering ikke dækker referencen.
    expect(resolveSfggSegmentRateForDate({ ...args, sfggSource: { kind: 'manuel' }, reguleringOpslag: opslag }))
      .toEqual({ satsOre: 25_000, agPensionPct: 0, reguleringsindeks: null });
  });

  it.each([0, 1, 300_000, 4_000_000])('bygger SFGG sin egen KL-kæde uanset TAF-basis på %i øre', (tafBasisOre) => {
    const opslag = sfggReguleringOpslagFraSegmenter([{
      kind: 'maaneder', fra: iso('2022-01-01'), til: iso('2023-12-31'), maaneder: 24,
      maanedsloenOre: moneyOre(tafBasisOre), reguleretLoenOre: moneyOre(tafBasisOre),
      regulering: buildReguleringsbevis(tafBasisOre, tafBasisOre, { kind: 'klLoenaftaler' }),
      deltaPct: 0, amountOre: moneyOre(0),
    }]);
    const rates = ['2022-09-01', '2022-10-01', '2023-04-01', '2023-10-01'].map((dato) => resolveSfggSegmentRateForDate({
      iso: iso(dato), employment: createSfggEmployment(), sfggRow: createSfggIngenRow('af-1'),
      sfggSource: { kind: 'ferielov' }, reguleringOpslag: opslag,
      sfggBaseRate: {
        sfggReferenceperiode: { fra: iso('2022-01-01'), til: iso('2022-01-31') },
        sfggReferencesatsOre: { status: 'ok', value: moneyOre(25_000) }, sfggReferencesatsFormula: null,
      },
    }));
    // Øreafrunding af 250 × 1,0255; derpå 256,38 × 1,003; derpå 257,15 × 1,0125.
    expect(rates.map((rate) => rate?.satsOre)).toEqual([25_000, 25_638, 25_715, 26_036]);
    expect(rates.map((rate) => rate?.reguleringsindeks)).toEqual([null, null, null, null]);
    expect(rates[3]?.reguleringsgrundlag).toBeUndefined();
    expect(rates[3]?.klTrin).toEqual([
      { dato: iso('2022-10-01'), pct: 2.55, retning: 'frem', loenFoer: 250, loenEfter: 256.38 },
      { dato: iso('2023-04-01'), pct: 0.3, retning: 'frem', loenFoer: 256.38, loenEfter: 257.15 },
      { dato: iso('2023-10-01'), pct: 1.25, retning: 'frem', loenFoer: 257.15, loenEfter: 260.36 },
    ]);
  });
  it('fordeler øre proportionalt, bevarer rest og håndterer tomme eller nulvægtede segmenter', () => {
    expect([...allocateOreByWeights(moneyOre(10), [])]).toEqual([]);
    expect([...allocateOreByWeights(moneyOre(0), [{ key: 'a', weight: 1 }])]).toEqual([]);
    expect([...allocateOreByWeights(moneyOre(10), [
      { key: 'a', weight: 0 },
      { key: 'b', weight: -1 },
    ])]).toEqual([['a', 10]]);
    expect([...allocateOreByWeights(moneyOre(10), [
      { key: 'a', weight: 1 },
      { key: 'b', weight: 2 },
    ])]).toEqual([['a', 4], ['b', 6]]);
  });

  it('fordeler en grouped segments total efter år og falder tilbage til antal datoer ved opbrugt rest', () => {
    const yearDates = new Map([
      [2025, [iso('2025-01-01')]],
      [2024, [iso('2024-01-01'), iso('2024-01-02')]],
    ]);

    expect([...buildYearAllocationsForGroupedSegment({
      yearDates,
      satsOre: moneyOre(1_000),
      agPensionPct: 0,
      alreadyPaidSegmentOre: moneyOre(0),
      segmentTotalOre: moneyOre(300),
      feriepengeOreByYear: new Map(),
    })]).toEqual([[2024, 200], [2025, 100]]);

    expect([...buildYearAllocationsForGroupedSegment({
      yearDates,
      satsOre: moneyOre(1_000),
      agPensionPct: 0,
      alreadyPaidSegmentOre: moneyOre(10_000),
      segmentTotalOre: moneyOre(300),
      feriepengeOreByYear: new Map([[2024, moneyOre(1_000_000)]]),
    })]).toEqual([[2024, 200], [2025, 100]]);
    expect([...buildYearAllocationsForGroupedSegment({
      yearDates: new Map(),
      satsOre: moneyOre(1_000),
      agPensionPct: 0,
      alreadyPaidSegmentOre: moneyOre(0),
      segmentTotalOre: moneyOre(300),
      feriepengeOreByYear: new Map(),
    })]).toEqual([]);
  });

  it('bygger brutto SFGG og kalkulatorens løn- og feriepengeprojektion', () => {
    expect(buildSfggGrossOre(moneyOre(1_000), 10, 3)).toBe(3_300);
    expect(buildSfggGrossOre(moneyOre(1_000), 10, 0)).toBe(0);

    const employment = createSfggEmployment({
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-jan',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asSfggAmount(10_000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'tom-række',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: undefined,
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'nul-række',
          col0_maaned: '2',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asSfggAmount(0),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    });
    const calculator = buildEmploymentSfggCalculator(employment, []);
    const eligibleDates = buildEligibleDatesForSfggRange({
      range: { fra: iso('2024-01-01'), til: iso('2024-01-31') },
      sfggDayBasis: 'arbejdsdage',
      ferieperioder: [],
    });

    expect(eligibleDates.length).toBeGreaterThan(0);
    expect(calculator.sumLoenInRangesKroner([])).toBe(0);
    expect(calculator.sumLoenInRangesKroner([
      { fra: iso('2024-01-31'), til: iso('2024-01-01') },
    ])).toBe(0);
    expect(calculator.sumLoenInRangesKroner([
      { fra: iso('2024-01-01'), til: iso('2024-01-31') },
    ])).toBe(10_000);
    expect(calculator.sumLoenForDatesKroner([])).toBe(0);
    expect(calculator.sumLoenForDatesKroner(eligibleDates)).toBe(10_000);
    expect(toKroner(calculator.buildFeriepengeOreForDates(eligibleDates))).toBe(1_250.04);
    expect(toKroner(calculator.buildFeriepengeOreForDates(eligibleDates))).toBe(1_250.04);
    expect([...calculator.buildFeriepengeOreByYear(eligibleDates)]).toEqual([[2024, 125_004]]);
  });

  it('modregner en negativ lønseddel i referencelønnen, som den tabte arbejdsfortjeneste gør (BB-290)', () => {
    // Juni 30.000 kr. og en tilbagebetaling i juli på -2.000 kr.: referencelønnen er 28.000 kr. (før: 30.000 kr.).
    const maanedsRaekke = (id: string, maaned: string, beloeb: number) => ({
      id, col0_maaned: maaned, col1_maaned: '2017', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
      col2: asSfggAmount(beloeb), col3: undefined, col4: undefined, col5: undefined,
    });
    const calculator = buildEmploymentSfggCalculator(createSfggEmployment({
      indtaegtsoplysningerTableData: [maanedsRaekke('juni', '6', 30_000), maanedsRaekke('juli', '7', -2_000)],
    }), []);

    expect(calculator.sumLoenInRangesKroner([{ fra: iso('2017-06-01'), til: iso('2017-07-31') }])).toBeCloseTo(28_000, 6);
    // En dag, hvis rækker samlet er negative, giver 0 kr. i modtagne feriepenge – aldrig et negativt beløb.
    expect(calculator.buildFeriepengeOreForDates([iso('2017-07-03')])).toBe(0);
  });

  it('bygger kalender- og arbejdsdagsmængder med sortering og ugyldig periode som tom', () => {
    expect(buildEligibleDatesForSfggRange({
      range: { fra: iso('2024-01-01'), til: iso('2024-01-03') },
      sfggDayBasis: 'kalenderdage',
      ferieperioder: [],
    })).toEqual([iso('2024-01-01'), iso('2024-01-02'), iso('2024-01-03')]);
    expect(buildEligibleDatesForSfggRange({
      range: { fra: iso('2024-01-03'), til: iso('2024-01-01') },
      sfggDayBasis: 'kalenderdage',
      ferieperioder: [],
    })).toEqual([]);
    expect(buildEligibleDatesForSfggRange({
      range: { fra: iso('2024-01-01'), til: iso('2024-01-07') },
      sfggDayBasis: 'arbejdsdage',
      ferieperioder: [{ id: 'ferie-1', fra: iso('2024-01-02'), til: iso('2024-01-02') }],
    })).toEqual([iso('2024-01-03'), iso('2024-01-04'), iso('2024-01-05')]);
  });

  it('samler segmentgrænser fra referenceforløb og ignorerer dem for manuel kilde', () => {
    const reguleringOpslag = sfggReguleringOpslagFraSegmenter([
      {
        kind: 'maaneder' as const,
        fra: iso('2024-05-01'),
        til: iso('2024-12-31'),
        maaneder: 8,
        maanedsloenOre: moneyOre(300_000),
        deltaPct: 10,
        amountOre: moneyOre(2_640_000),
      },
      {
        kind: 'maaneder' as const,
        fra: iso('2024-01-01'),
        til: iso('2024-04-30'),
        maaneder: 4,
        maanedsloenOre: moneyOre(300_000),
        deltaPct: 0,
        amountOre: moneyOre(1_200_000),
      },
    ]);
    const args = {
      ranges: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }],
      employment: createSfggEmployment(),
      reguleringOpslag,
    };

    expect(resolveSfggSegmentBoundaryStarts({ ...args, sfggSource: { kind: 'ferielov' } })).toEqual([
      iso('2024-01-01'),
      iso('2024-05-01'),
    ]);
    expect(resolveSfggSegmentBoundaryStarts({ ...args, sfggSource: { kind: 'manuel' } })).toEqual([]);
  });

  it('resolver sats for direkte og referencebaseret kilde samt uberegnelig referencesats', () => {
    const employment = createSfggEmployment();
    const sfggRow = createSfggIngenRow(employment.id);
    const referenceBaseRate = {
      sfggReferenceperiode: { fra: iso('2024-01-01'), til: iso('2024-01-31') },
      sfggReferencesatsOre: { status: 'ok' as const, value: moneyOre(10_000) },
      sfggReferencesatsFormula: null,
    };
    const reguleringOpslag = sfggReguleringOpslagFraSegmenter([{
      kind: 'maaneder' as const,
      fra: iso('2024-01-01'),
      til: iso('2024-12-31'),
      maaneder: 12,
      maanedsloenOre: moneyOre(300_000),
      deltaPct: 10,
      amountOre: moneyOre(3_960_000),
    }]);

    expect(resolveSfggSegmentRateForDate({
      iso: iso('2024-06-01'),
      employment,
      sfggRow,
      sfggSource: { kind: 'ferielov' },
      sfggBaseRate: referenceBaseRate,
      reguleringOpslag,
    })).toEqual({ satsOre: 10_000, agPensionPct: 0, reguleringsindeks: 100, reguleringsgrundlag: { referenceValue: 110, periodValue: 110 } });
    expect(resolveSfggSegmentRateForDate({
      iso: iso('2024-06-01'),
      employment,
      sfggRow,
      sfggSource: { kind: 'manuel' },
      sfggBaseRate: referenceBaseRate,
      reguleringOpslag,
    })).toEqual({ satsOre: 10_000, agPensionPct: 0, reguleringsindeks: null });
    expect(resolveSfggSegmentRateForDate({
      iso: iso('2024-06-01'),
      employment,
      sfggRow,
      sfggSource: { kind: 'ferielov' },
      sfggBaseRate: {
        ...referenceBaseRate,
        sfggReferencesatsOre: { status: 'not_calculable', kind: 'missing_rate', reason: 'Dagssats mangler' },
      },
      reguleringOpslag,
    })).toBeNull();
    expect(resolveSfggSegmentRateForDate({
      iso: iso('2024-06-01'),
      employment,
      sfggRow,
      sfggSource: { kind: 'overenskomst_direkte' },
      sfggBaseRate: referenceBaseRate,
      reguleringOpslag,
    })).toBeNull();
  });

  it('samler kendte private overenskomstgrænser i et løninterval', () => {
    const starts = resolveSfggSegmentBoundaryStarts({
      ranges: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }],
      employment: createSfggEmployment({ overenskomstId: 'bygge-anlaeg' }),
      sfggSource: { kind: 'manuel' },
      reguleringOpslag: undefined,
    });

    expect(starts.length).toBeGreaterThan(0);
    expect(starts).toEqual([...starts].sort());
    expect(starts.every((start) => start >= iso('2024-01-01') && start <= iso('2024-12-31'))).toBe(true);
  });

  it('regulerer SFGG uafhængigt af KL-nulbasis og afviser korrupte nulsegmenter', () => {
    const segment = {
      kind: 'arbejdsdage' as const, fra: iso('2024-01-01'), til: iso('2024-12-31'),
      arbejdsdage: 260, dagsloenOre: moneyOre(0), deltaPct: 0, amountOre: moneyOre(0),
      reguleretLoenOre: moneyOre(0), regulering: buildReguleringsbevis(0, 0, { kind: 'klLoenaftaler' }),
    };
    const args = {
      iso: iso('2024-06-01'), employment: createSfggEmployment(), sfggRow: createSfggIngenRow('af-1'),
      sfggSource: { kind: 'ferielov' as const },
      sfggBaseRate: {
        sfggReferenceperiode: { fra: iso('2024-01-01'), til: iso('2024-01-31') },
        sfggReferencesatsOre: { status: 'ok' as const, value: moneyOre(10_000) },
        sfggReferencesatsFormula: null,
      },
    };
    expect(resolveSfggSegmentRateForDate({ ...args, reguleringOpslag: sfggReguleringOpslagFraSegmenter([segment]) }))
      .toMatchObject({ satsOre: 10_400, agPensionPct: 0, reguleringsindeks: null, klTrin: [{ dato: iso('2024-04-01'), pct: 4, retning: 'frem', loenFoer: 100, loenEfter: 104 }] });
    for (const patch of [{ deltaPct: 1 }, { reguleretLoenOre: moneyOre(1) }, { regulering: undefined }]) {
      expect(() => resolveSfggSegmentRateForDate({
        ...args, reguleringOpslag: sfggReguleringOpslagFraSegmenter([{ ...segment, ...patch }]),
      })).toThrow('mangler positiv basisløn');
    }
  });

  it('afviser inkonsistent KL-segmentering i referenceforløbet', () => {
    const baseArgs = {
      iso: iso('2024-06-01'),
      employment: createSfggEmployment(),
      sfggRow: createSfggIngenRow('af-1'),
      sfggSource: { kind: 'ferielov' as const },
      sfggBaseRate: {
        sfggReferenceperiode: { fra: iso('2024-01-01'), til: iso('2024-01-31') },
        sfggReferencesatsOre: { status: 'ok' as const, value: moneyOre(10_000) },
        sfggReferencesatsFormula: null,
      },
    };

    expect(() => resolveSfggSegmentRateForDate({
      ...baseArgs,
      reguleringOpslag: sfggReguleringOpslagFraSegmenter([{
        kind: 'maaneder' as const,
        fra: iso('2024-01-01'),
        til: iso('2024-12-31'),
        maaneder: 12,
        maanedsloenOre: moneyOre(0),
        deltaPct: 10,
        amountOre: moneyOre(0),
        reguleretLoenOre: moneyOre(0),
      }]),
    })).toThrow('mangler positiv basisløn');
    expect(() => resolveSfggSegmentRateForDate({
      ...baseArgs,
      reguleringOpslag: sfggReguleringOpslagFraSegmenter([{
        kind: 'maaneder' as const,
        fra: iso('2024-01-01'),
        til: iso('2024-12-31'),
        maaneder: 12,
        maanedsloenOre: moneyOre(300_000),
        deltaPct: 10,
        amountOre: moneyOre(3_300_000),
        reguleretLoenOre: moneyOre(300_001),
      }]),
    })).toThrow('interne regulering matcher ikke');
  });

  it('vælger den differentierede direkte overenskomstsats efter faggruppe og område', () => {
    // Overenskomsten skal være AKTIV (toggle + id), før pensionen hentes fra den.
    const employment = createSfggEmployment({ harOverenskomst: true, overenskomstId: 'bygge-anlaeg' });
    const baseArgs = {
      iso: iso('2024-01-15'),
      employment,
      sfggSource: { kind: 'overenskomst_direkte' as const },
      sfggBaseRate: {
        sfggReferenceperiode: null,
        sfggReferencesatsOre: { status: 'ok' as const, value: moneyOre(1) },
        sfggReferencesatsFormula: null,
      },
      reguleringOpslag: undefined,
    };
    const expected = [
      ['Faglaert-Koebenhavn', 20_790],
      ['Faglaert-Provinsen', 19_590],
      ['Ufaglaert-Koebenhavn', 18_445],
      ['Ufaglaert-Provinsen', 18_645],
    ] as const;

    for (const [sfggSatsvalg, satsOre] of expected) {
      expect(resolveSfggSegmentRateForDate({
        ...baseArgs,
        sfggRow: { ...createSfggIngenRow(employment.id), sfggSatsvalg },
      })).toMatchObject({ satsOre, agPensionPct: 10.15, reguleringsindeks: null });
    }
    expect(resolveSfggSegmentRateForDate({
      ...baseArgs,
      sfggRow: createSfggIngenRow(employment.id),
    })).toBeNull();
  });

  it('falder sikkert tilbage ved ukendt overenskomst i sats-, pension- og grænsespor', () => {
    const unknownEmployment = createSfggEmployment({
      overenskomstId: 'ukendt-overenskomst',
      pensionPct: 7,
    });
    const baseArgs = {
      iso: iso('2024-01-15'),
      employment: unknownEmployment,
      sfggRow: createSfggIngenRow(unknownEmployment.id),
      sfggBaseRate: {
        sfggReferenceperiode: { fra: iso('2024-01-01'), til: iso('2024-01-31') },
        sfggReferencesatsOre: { status: 'ok' as const, value: moneyOre(10_000) },
        sfggReferencesatsFormula: null,
      },
      reguleringOpslag: undefined,
    };

    expect(resolveSfggSegmentRateForDate({
      ...baseArgs,
      sfggSource: { kind: 'overenskomst_direkte' },
    })).toBeNull();
    expect(resolveSfggSegmentRateForDate({
      ...baseArgs,
      sfggSource: { kind: 'ferielov' },
    })).toEqual({ satsOre: 10_000, agPensionPct: 7, reguleringsindeks: null });
    expect(resolveSfggSegmentBoundaryStarts({
      ranges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
      employment: unknownEmployment,
      sfggSource: { kind: 'manuel' },
      reguleringOpslag: undefined,
    })).toEqual([]);
  });
});

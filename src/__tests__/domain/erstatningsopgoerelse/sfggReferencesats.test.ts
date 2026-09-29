import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  getFirstIndtastedeTafFraDato,
  isSfggNoEligibleDaysNotCalculable,
  notCalculableSfggReferencesats,
  resolveSfggBaseRate,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggReferenceperiodeMaxDate,
} from '../../../domain/erstatningsopgoerelse/engines/sfggReferencesats';
import { asSfggAmount, createSfggEmployment, createSfggIngenRow, sfggIso as iso } from '../../utils/sfggTestSupport';

describe('sfggReferencesats', () => {
  it('bygger alle kendte ikke-beregnelige referencesatsårsager og genkender nul-dage', () => {
    const cases = [
      ['missing_rate', 'Dagssats mangler'],
      ['per_period_rate', 'Direkte overenskomstsats beregnes pr. periode'],
      ['missing_referenceperiode', 'Referenceperiode mangler'],
      ['unresolvable_referenceperiode', 'Referenceperioden kan ikke opgøres'],
      ['no_calendar_days', 'Ingen kalenderdage i SFGG-perioden'],
      ['no_workdays', 'Ingen arbejdsdage i SFGG-perioden'],
    ] as const;

    for (const [kind, reason] of cases) {
      expect(notCalculableSfggReferencesats(kind)).toEqual({
        status: 'not_calculable',
        kind,
        reason,
      });
    }

    expect(isSfggNoEligibleDaysNotCalculable(notCalculableSfggReferencesats('no_calendar_days'))).toBe(true);
    expect(isSfggNoEligibleDaysNotCalculable(notCalculableSfggReferencesats('no_workdays'))).toBe(true);
    expect(isSfggNoEligibleDaysNotCalculable(notCalculableSfggReferencesats('missing_rate'))).toBe(false);
  });

  it('beregner manuel referencesats og afviser manglende manuel dagssats', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const employment = createSfggEmployment();
    const calculator = { sumLoenInRangesKroner: () => 0 };

    expect(resolveSfggBaseRate(
      values,
      employment,
      { ...createSfggIngenRow(employment.id), sfggManuelDagssats: asSfggAmount(123.456) },
      { kind: 'manuel' },
      calculator
    ).sfggReferencesatsOre.status).toBe('ok');

    expect(resolveSfggBaseRate(
      values,
      employment,
      undefined,
      { kind: 'manuel' },
      calculator
    )).toMatchObject({
      sfggReferenceperiode: null,
      sfggReferencesatsOre: {
        status: 'not_calculable',
        kind: 'missing_rate',
      },
      sfggReferencesatsFormula: null,
    });
  });

  it('afviser direkte overenskomstsats som referencesats', () => {
    const result = resolveSfggBaseRate(
      createErstatningsopgoerelseInitialValues(),
      createSfggEmployment(),
      undefined,
      { kind: 'overenskomst_direkte' },
      { sumLoenInRangesKroner: () => 0 }
    );

    expect(result).toMatchObject({
      sfggReferenceperiode: null,
      sfggReferencesatsOre: {
        status: 'not_calculable',
        kind: 'per_period_rate',
      },
      sfggReferencesatsFormula: null,
    });
  });

  it('beregner referencesatsformlen og håndterer nul kalender- og arbejdsdage', () => {
    const employment = createSfggEmployment();
    const calculator = { sumLoenInRangesKroner: () => 1_000 };
    const referenceRow = {
      ...createSfggIngenRow(employment.id),
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-07'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
    };

    const calculable = resolveSfggBaseRate(
      createErstatningsopgoerelseInitialValues(),
      employment,
      referenceRow,
      { kind: 'ferielov' },
      calculator
    );
    expect(calculable.sfggReferencesatsOre.status).toBe('ok');
    expect(calculable.sfggReferencesatsFormula).toMatchObject({
      loenPlusLoen2PlusIkkePensLoenKroner: 1_000,
      feriePctDecimal: 0.125,
      divisorDage: 7,
      divisorLabel: 'kalenderdage',
    });

    const noCalendarDaysValues = createErstatningsopgoerelseInitialValues();
    noCalendarDaysValues.ferieperioder = [{ id: 'ferie-weekend', fra: iso('2024-01-06'), til: iso('2024-01-07') }];
    expect(resolveSfggBaseRate(
      noCalendarDaysValues,
      employment,
      { ...referenceRow, sfggReferenceperiodeFravaersdageUdenLoen: 10 },
      { kind: 'ferielov' },
      calculator
    ).sfggReferencesatsOre).toMatchObject({
      status: 'not_calculable',
      kind: 'no_calendar_days',
    });

    const noWorkdaysValues = createErstatningsopgoerelseInitialValues();
    noWorkdaysValues.beregnesUdFra = 'Angivet dagsløn';
    expect(resolveSfggBaseRate(
      noWorkdaysValues,
      employment,
      {
        ...referenceRow,
        sfggReferenceperiodeFra: iso('2024-01-06'),
        sfggReferenceperiodeTil: iso('2024-01-07'),
      },
      { kind: 'overenskomst_ferielov' },
      calculator
    ).sfggReferencesatsOre).toMatchObject({
      status: 'not_calculable',
      kind: 'no_workdays',
    });
  });

  describe('resolveSfggReferenceperiodeDayCount', () => {
    it('returnerer null ved manglende eller omvendt referenceperiode', () => {
      const values = createErstatningsopgoerelseInitialValues();

      expect(resolveSfggReferenceperiodeDayCount(values, undefined, { kind: 'ferielov' })).toBeNull();
      expect(resolveSfggReferenceperiodeDayCount(values, {
        sfggReferenceperiodeFra: iso('2024-02-01'),
        sfggReferenceperiodeTil: iso('2024-01-01'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
      }, { kind: 'ferielov' })).toBeNull();
    });

    it('opgør arbejdsdage med særskilte SH-, ferie- og fraværsled', () => {
      const values = createErstatningsopgoerelseInitialValues();
      values.beregnesUdFra = 'Angivet månedsløn';
      values.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-01-02'), til: iso('2024-01-02') }];

      expect(resolveSfggReferenceperiodeDayCount(values, {
        sfggReferenceperiodeFra: iso('2024-01-01'),
        sfggReferenceperiodeTil: iso('2024-01-07'),
        sfggReferenceperiodeFravaersdageUdenLoen: 1,
      }, { kind: 'manuel' })).toEqual({
        divisorDage: 2,
        divisorLabel: 'arbejdsdage',
        kalenderdage: 7,
        hverdage: 5,
        shDage: 1,
        feriedage: 1,
        oevrigeFravaersdage: 1,
      });
    });

    it('tæller weekenddage i feriefradraget på kalenderdagssporet og clamper divisoren til 0', () => {
      const values = createErstatningsopgoerelseInitialValues();
      values.beregnesUdFra = 'Angivet månedsløn';
      values.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-01-06'), til: iso('2024-01-07') }];

      expect(resolveSfggReferenceperiodeDayCount(values, {
        sfggReferenceperiodeFra: iso('2024-01-01'),
        sfggReferenceperiodeTil: iso('2024-01-07'),
        sfggReferenceperiodeFravaersdageUdenLoen: 10,
      }, { kind: 'ferielov' })).toEqual({
        divisorDage: 0,
        divisorLabel: 'kalenderdage',
        kalenderdage: 7,
        hverdage: 5,
        shDage: 1,
        feriedage: 2,
        oevrigeFravaersdage: 10,
      });
    });
  });

  it('klassificerer en omvendt referenceperiode som manglende beregningsgrundlag', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const result = resolveSfggBaseRate(
      values,
      createSfggEmployment(),
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2024-02-01'),
        sfggReferenceperiodeTil: iso('2024-01-01'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
      },
      { kind: 'ferielov' },
      { sumLoenInRangesKroner: () => 0 }
    );

    expect(result).toEqual({
      sfggReferenceperiode: null,
      sfggReferencesatsOre: {
        status: 'not_calculable',
        kind: 'missing_referenceperiode',
        reason: 'Referenceperiode mangler',
      },
      sfggReferencesatsFormula: null,
    });
  });

  describe('TAF-referencegrænse', () => {
    it('finder den tidligste udfyldte fra-dato i usorterede og delvist tomme rækker', () => {
      const values = createErstatningsopgoerelseInitialValues();
      values.tafPerioder = [
        { id: 'taf-1', fra: iso('2024-05-10'), til: iso('2024-05-20') },
        { id: 'taf-2', fra: undefined, til: iso('2024-04-30') },
        { id: 'taf-3', fra: iso('2024-05-01'), til: iso('2024-05-05') },
      ];

      expect(getFirstIndtastedeTafFraDato(values)).toBe(iso('2024-05-01'));
      expect(resolveSfggReferenceperiodeMaxDate(values)).toBe(iso('2024-04-30'));
    });
  });
});

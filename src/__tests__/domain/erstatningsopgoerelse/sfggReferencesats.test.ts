import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  getFirstIndtastedeTafFraDato,
  resolveSfggBaseRate,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggReferenceperiodeMaxDate,
} from '../../../domain/erstatningsopgoerelse/engines/sfggReferencesats';
import { createSfggEmployment, sfggIso as iso } from '../../utils/sfggTestSupport';

describe('sfggReferencesats', () => {
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

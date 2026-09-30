import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  buildEoCanonicalOutputFromComputed,
  buildEoComputedTotals,
  type EoComputedTotals,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { LoenudviklingModel, LoenudviklingSegment } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { MoneyOre } from '../../../domain/money/money';
import { moneyOre } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const buildComputedFixture = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  const eoValues = {
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 }],
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
        indtaegtsoplysningerTableData: [],
      },
    ],
    eoAngivetLoenLoenudvikling: {
      ...initial.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
    },
  };
  const stamdata = {
    ...STAMDATA_INITIAL_VALUES,
    skadestype: 'Arbejdsulykke' as const,
    skadedato: iso('2024-01-01'),
  };
  const snapshot = computeEoSnapshot({
    revision: 'canonical-direct-test',
    stamdataValues: stamdata,
    eoValues: withSfggIngenForEmployments(eoValues),
  });
  if (!snapshot.data) throw new Error('Forventede beregnet EO-fixture');
  return snapshot.data;
};

const buildCanonicalArgs = () => {
  const data = buildComputedFixture();
  return {
    data,
    args: {
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-06-30') }],
      svieSmerte: data.engines.svieSmerte,
      tafNetto: data.engines.tafNetto,
      totals: data.totals,
    },
  };
};

describe('eoCanonicalOutput – direkte invariantgrene', () => {
  it('håndterer både ikke-beregnelig tidligere TAF og forligsfaktor i totalbyggeren', () => {
    const { data } = buildCanonicalArgs();
    const udenTidligereTaf = {
      ...data.engines.tafNetto,
      tidligereModtagetTaf: { status: 'not_calculable' as const, reason: 'test' },
    };

    const udenForlig = buildEoComputedTotals({
      svieSmerte: data.engines.svieSmerte,
      tafNetto: udenTidligereTaf,
      oevrige: data.engines.oevrigeKrav,
      forligFactor: null,
    });
    expect(udenForlig.tidligereModtagetTafOre).toBe(0);
    expect(udenForlig.forligFactor).toBeNull();

    const medForlig = buildEoComputedTotals({
      svieSmerte: data.engines.svieSmerte,
      tafNetto: {
        ...data.engines.tafNetto,
        tidligereModtagetTaf: { status: 'ok', value: moneyOre(1234) },
      },
      oevrige: data.engines.oevrigeKrav,
      forligFactor: 0.5,
    });
    expect(medForlig.forligFactor).toBe(0.5);
    expect(medForlig.tidligereModtagetTafOre).toBe(1234);
  });

  it('projekterer manglende beregningsmodeller som null og tomme arrays', () => {
    const { args } = buildCanonicalArgs();
    const output = buildEoCanonicalOutputFromComputed({
      ...args,
      tafNetto: {
        ...args.tafNetto,
        loenudvikling: null,
        offentligeYdelserUdvikling: null,
        tafIndtaegter: null,
        tidligereModtagetTaf: { status: 'not_calculable', reason: 'test' },
      },
    });

    expect(output.taf.offentligeYdelserUdviklingOre).toBeNull();
    expect(output.taf.tafIndtaegterOre).toBeNull();
    expect(output.taf.tidligereModtagetTafOre).toBeNull();
    expect(output.regulering.loenudviklingTotalFoerForligOre).toBeNull();
    expect(output.regulering.loenudviklingSegmenter).toEqual([]);
    expect(output.regulering.perAnsaettelse).toEqual([]);
  });

  it('lukker ved et lønudviklingssegment der bryder canonical-segmentets invariant', () => {
    const { args } = buildCanonicalArgs();
    const invalidSegment = {
      kind: 'maaneder',
      fra: iso('2024-01-01'),
      til: iso('2024-01-31'),
      maaneder: 1,
      maanedsloenOre: moneyOre(10000),
      deltaPct: 0,
      amountOre: moneyOre(10000),
      reguleretLoenOre: moneyOre(10001),
    } as unknown as LoenudviklingSegment;
    const sourceLoenudvikling = args.tafNetto.loenudvikling;
    const loenudvikling: LoenudviklingModel = sourceLoenudvikling
      ? { ...sourceLoenudvikling, beregnedeSegmenter: [invalidSegment], perAnsaettelse: [] }
      : {
          loenudviklingLabel: 'Test',
          loenudviklingTotal: { status: 'ok', value: moneyOre(0) },
          beregningsenhed: 'Måneder',
          beregnedeSegmenter: [invalidSegment],
          perAnsaettelse: [],
        };

    expect(() => buildEoCanonicalOutputFromComputed({
      ...args,
      tafNetto: { ...args.tafNetto, loenudvikling },
    })).toThrow(/loenudviklingSegment/);
  });

  it('validerer reguleret månedssegment og viderefører en beregnelig tidligere TAF', () => {
    const { args } = buildCanonicalArgs();
    const validSegment: LoenudviklingSegment = {
      kind: 'maaneder',
      fra: iso('2024-01-01'),
      til: iso('2024-01-31'),
      maaneder: 1,
      maanedsloenOre: moneyOre(10000),
      deltaPct: 0,
      amountOre: moneyOre(10001),
      reguleretLoenOre: moneyOre(10001),
    };
    const validArbejdsdageSegment: LoenudviklingSegment = {
      kind: 'arbejdsdage',
      fra: iso('2024-02-01'),
      til: iso('2024-02-01'),
      arbejdsdage: 1,
      dagsloenOre: moneyOre(10000),
      deltaPct: 0,
      amountOre: moneyOre(10001),
      reguleretLoenOre: moneyOre(10001),
    };
    const sourceLoenudvikling = args.tafNetto.loenudvikling;
    const loenudvikling: LoenudviklingModel = sourceLoenudvikling
      ? {
          ...sourceLoenudvikling,
          beregnedeSegmenter: [validSegment],
          perAnsaettelse: [{
            ansaettelsesforholdId: 'af-1',
            ansaettelsesforholdNavn: 'Test',
            loenudviklingLabel: 'Test',
            loenudviklingTotal: { status: 'not_calculable', reason: 'test' },
            beregnedeSegmenter: [validArbejdsdageSegment],
          }],
        }
      : {
          loenudviklingLabel: 'Test',
          loenudviklingTotal: { status: 'ok', value: moneyOre(0) },
          beregningsenhed: 'Måneder',
          beregnedeSegmenter: [validSegment],
          perAnsaettelse: [{
            ansaettelsesforholdId: 'af-1',
            ansaettelsesforholdNavn: 'Test',
            loenudviklingLabel: 'Test',
            loenudviklingTotal: { status: 'not_calculable', reason: 'test' },
            beregnedeSegmenter: [validArbejdsdageSegment],
          }],
        };

    const output = buildEoCanonicalOutputFromComputed({
      ...args,
      tafNetto: {
        ...args.tafNetto,
        loenudvikling,
        tidligereModtagetTaf: { status: 'ok', value: moneyOre(1234) },
      },
    });
    expect(output.regulering.loenudviklingSegmenter).toEqual([validSegment]);
    expect(output.regulering.perAnsaettelse[0]?.loenudviklingSegmenter).toEqual([validArbejdsdageSegment]);
    expect(output.taf.tidligereModtagetTafOre).toBe(1234);
  });

  it('formaterer en root-schemafejl fra et manglende segment som root-fejl', () => {
    const { args } = buildCanonicalArgs();
    const sourceLoenudvikling = args.tafNetto.loenudvikling;
    const loenudvikling: LoenudviklingModel = sourceLoenudvikling
      ? { ...sourceLoenudvikling, beregnedeSegmenter: [null as unknown as LoenudviklingSegment], perAnsaettelse: [] }
      : {
          loenudviklingLabel: 'Test',
          loenudviklingTotal: { status: 'ok', value: moneyOre(0) },
          beregningsenhed: 'Måneder',
          beregnedeSegmenter: [null as unknown as LoenudviklingSegment],
          perAnsaettelse: [],
        };

    expect(() => buildEoCanonicalOutputFromComputed({
      ...args,
      tafNetto: { ...args.tafNetto, loenudvikling },
    })).toThrow(/<root>/);
  });

  it('lukker ved et canonical-output der ikke længere matcher moneyOre-schemaet', () => {
    const { args } = buildCanonicalArgs();
    const invalidTotals: EoComputedTotals = {
      ...args.totals,
      samletTotalOre: 1.5 as unknown as MoneyOre,
    };

    expect(() => buildEoCanonicalOutputFromComputed({
      ...args,
      totals: invalidTotals,
    })).toThrow(/eoCanonicalOutput/);
  });
});

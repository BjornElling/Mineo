import type { RenteberegningOutput } from '../../domain/renteberegning/renteberegningEngine';
import type { TafEngineOutput } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { VarigeMenEngineOutput } from '../../domain/varigemen/varigeMenEngine';
import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import { computeErstatningsopgoerelseAggregation } from '../../calculation/pipeline/erstatningsopgoerelseAggregationPipeline';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const buildRenteOutput = (): RenteberegningOutput => ({
  rows: [{ id: 'r1', actualInterestDate: null, calculatedInterest: 100 }],
});

const buildTafOutput = (): TafEngineOutput => ({
  beregningsenhed: 'Måneder',
  rows: [{ id: 't1', value: 200 }],
});

const buildVarigtMenOutput = (): VarigeMenEngineOutput => ({
  result: {
    beregnetGodtgoerelse: 300,
    grundbeloeb: 300,
    satsPerMengrad: 100,
    aldersreduktionPct: 0,
    grundbeloebUdenReduktion: 300,
    alderVedSkade: 40,
  },
});

const buildComputedAmount = (amount: number): AggregatableComputed => ({ amount });

describe('erstatningsopgoerelseAggregationPipeline', () => {
  it('fails closed when EET adapter output is missing', () => {
    const manualValues = {
      ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
    };

    const result = computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: manualValues,
      renteOutput: buildRenteOutput(),
      tafOutput: buildTafOutput(),
      varigtMenOutput: buildVarigtMenOutput(),
      // EET intentionally omitted to verify gating.
      svieSmerteOutput: buildComputedAmount(10),
      loenindkomstOutput: buildComputedAmount(20),
      offentligeYdelserOutput: buildComputedAmount(5),
    });

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.errors.some((error) => error.lineId === 'eet' && error.code === 'missing_computed')).toBe(true);
  });
});

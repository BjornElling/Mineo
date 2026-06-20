import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeTafArbejdsdageAggregation } from '../../../domain/erstatningsopgoerelse/engines/tafBeregningsEngine';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';
import type { TafPeriodeRow } from '../../../schemas/formSchemas';

const initialEoValues = createErstatningsopgoerelseInitialValues();

const baseValues = () => ({
  ...initialEoValues,
});

describe('tafBeregningsEngine', () => {
  it('aggregates TAF hverdage when beregningsenhed is måneder', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2025-08-01'),
        til: toISODateString('2026-01-31'),
        loseFeriedage: 0,
      },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    });

    expect(aggregated).toBe(131);
  });

  it('aggregates TAF-dage when beregningsenhed is arbejdsdage', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };
    const tafPerioder: TafPeriodeRow[] = [
      {
        id: 'row-1',
        fra: toISODateString('2024-02-05'),
        til: toISODateString('2024-02-09'),
        loseFeriedage: 1,
      },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
    });

    expect(aggregated).toBe(4);
  });

  it('bruger autoritative clampede tafRanges som grundlag for løse feriedage i aggregation', () => {
    const values = {
      ...baseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      vedroererPeriodeFra: toISODateString('2024-02-05'),
      vedroererPeriodeTil: toISODateString('2024-02-12'),
    };
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'row-1', fra: toISODateString('2024-02-05'), til: toISODateString('2024-02-09'), loseFeriedage: 1 },
      { id: 'row-2', fra: toISODateString('2024-02-10'), til: toISODateString('2024-02-12'), loseFeriedage: 2 },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tafRanges: [{ fra: toISODateString('2024-02-05'), til: toISODateString('2024-02-12') }],
    });

    expect(aggregated).toBe(3);
  });

  it('returnerer null fra aggregation når alle TAF-rækker er ugyldige', () => {
    const values = baseValues();
    const tafPerioder: TafPeriodeRow[] = [
      { id: 'row-1', fra: undefined, til: toISODateString('2024-01-10'), loseFeriedage: 0 },
      { id: 'row-2', fra: toISODateString('2024-01-31'), til: toISODateString('2024-01-01'), loseFeriedage: 0 },
    ];

    const aggregated = computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder,
      ferieperioder: [],
      beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    });

    expect(aggregated).toBeNull();
  });
});

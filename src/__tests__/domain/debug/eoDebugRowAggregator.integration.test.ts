import { collectAllDebugRows } from '../../../domain/debug/eoDebugRowAggregator';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';

describe('collectAllDebugRows integration', () => {
  it('materialises svie/smerte sats-aar warning with summary message', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.opgørelseLavetDen = '2025-12-15';
    eoValues.svieSmerteSatserAar = 2025;
    eoValues.revideretOpgoerelse = 'Nej';

    const result = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      {},
      eoValues,
      {}
    );

    const row = result.warnings.find((entry) => entry.id === 'sviesmerte.satserAar');
    expect(row).toBeDefined();
    expect(row?.message).toBe('Svie/smerte satsen for 2026 kan anvendes.');
    expect(row?.summaryDisplay).toBe('messageOnly');
  });

  it('materialises TAF warning when valid periods are fully clamped outside EO-perioden', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-02-01';
    eoValues.vedroererPeriodeTil = '2024-02-29';
    eoValues.tafBeregningsperiodeFra = '2023-01-01';
    eoValues.tafBeregningsperiodeTil = '2023-12-31';
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: '2024-01-01', til: '2024-01-31', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-clamped-away',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([]);
    const result = collectAllDebugRows(
      STAMDATA_INITIAL_VALUES,
      {},
      eoValues,
      {},
      {},
      undefined,
      snapshot.data?.canonicalOutput
    );

    const row = result.warnings.find((entry) => entry.id === 'taf.perioder.clampedAway');
    expect(row).toBeDefined();
    expect(row?.message ?? row?.displayValue).toContain('TAF beregnes derfor til 0 kr.');
  });
});

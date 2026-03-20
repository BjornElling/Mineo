import { collectAllDebugRows } from '../../../domain/debug/eoDebugRowAggregator';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

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
});

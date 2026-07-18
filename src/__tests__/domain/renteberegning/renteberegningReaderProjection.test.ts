// @vitest-environment jsdom
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { buildRenteberegningReaderProjection } from '../../../domain/renteberegning/renteberegningReaderProjection';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../../inputCore/evaluationSource';

// Greenfield Renteberegning reader-projektion (§3.4/§5.4): beviser at projektionen (a) kører den EKSISTERENDE
// `computeRentekravRow` byte-identisk på reader-rekonstruerede rækker (§5.4 hårdt stop mod talændring) og (b)
// isolerer per-række (§1.10). Rejected-state-gating dækkes af Renteberegning-integrationstesten, der driver det
// rigtige felt; her fokuseres på den rene projektion over committed data.

const catalog = getProductionInputCatalog();

const createRow = (id: string, overrides?: Partial<RentekravRow>): RentekravRow => ({
  id,
  belob: { kind: 'number', value: 1_000 },
  renterFra: toISODateString('2024-01-01'),
  tillaegstid: 0,
  enhed: 'dage',
  ...overrides,
});

const buildReaderForRows = (rows: readonly RentekravRow[], beregningsdato: string | undefined) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: {
        beregningsdato: beregningsdato === undefined ? undefined : toISODateString(beregningsdato),
        kommentarer: undefined,
        rentekravRows: rows as RentekravRow[],
      },
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken, settings: DEFAULT_APP_SETTINGS }).reader;
};

describe('buildRenteberegningReaderProjection', () => {
  it('kører computeRentekravRow byte-identisk på de reader-rekonstruerede rækker (§5.4)', () => {
    const row = createRow('r1');
    const reader = buildReaderForRows([row], '2024-12-31');
    const projection = buildRenteberegningReaderProjection({
      reader, referenceRates, surchargeRates, revision: 1,
    });

    const rowProjection = projection.rowProjections.get('r1');
    expect(rowProjection?.status).toBe('ready');

    // Golden: præcis samme motor-resultat som en direkte kald med den committede række.
    const expected = computeRentekravRow(row, toISODateString('2024-12-31'), referenceRates, surchargeRates);
    if (rowProjection?.status !== 'ready') throw new Error('forventede ready');
    expect(rowProjection.data).toEqual(expected);
    expect(projection.aggregateProjection.status).toBe('ready');
  });

  it('isolerer per-række: to gyldige rækker er begge ready, og aggregatet er ready', () => {
    const reader = buildReaderForRows([createRow('r1'), createRow('r2')], '2024-12-31');
    const projection = buildRenteberegningReaderProjection({
      reader, referenceRates, surchargeRates, revision: 1,
    });
    expect(projection.rowProjections.get('r1')?.status).toBe('ready');
    expect(projection.rowProjections.get('r2')?.status).toBe('ready');
    expect(projection.aggregateProjection.status).toBe('ready');
    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.data.pdfContexts.size).toBe(2);
  });

  it('en tom række indgår ikke i aggregatets pdfContexts eller anyRowHasError', () => {
    const emptyRow: RentekravRow = { id: 'r-empty', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage' };
    const reader = buildReaderForRows([createRow('r1'), emptyRow], '2024-12-31');
    const projection = buildRenteberegningReaderProjection({
      reader, referenceRates, surchargeRates, revision: 1,
    });
    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.data.pdfContexts.size).toBe(1);
    expect(projection.aggregateProjection.data.anyRowHasError).toBe(false);
  });
});

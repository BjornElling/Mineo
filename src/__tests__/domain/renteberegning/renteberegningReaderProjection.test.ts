// @vitest-environment jsdom
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import {
  hasAnyRentekravInput,
  readRentekravCommittedRows,
  buildRenteberegningReaderProjection,
} from '../../../domain/renteberegning/renteberegningReaderProjection';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../../inputCore/evaluationSource';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { rentekravBelobField, rentekravRowsCollectionRef } from '../../../inputCore/catalog/renteberegningDescriptors';

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
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

describe('buildRenteberegningReaderProjection', () => {
  it('kører computeRentekravRow byte-identisk på de reader-rekonstruerede rækker (§5.4)', () => {
    const row = createRow('r1');
    const reader = buildReaderForRows([row], '2024-12-31');
    const projection = buildRenteberegningReaderProjection({
      reader, referenceRates, surchargeRates,
    });

    const rowProjection = projection.rowProjections.get('r1');
    expect(rowProjection?.status).toBe('ready');

    // Golden: præcis samme motor-resultat som en direkte kald med den committede række.
    const expected = computeRentekravRow(row, toISODateString('2024-12-31'), referenceRates, surchargeRates);
    if (rowProjection?.status !== 'ready') throw new Error('forventede ready');
    expect(rowProjection.value).toEqual(expected);
    expect(projection.aggregateProjection.status).toBe('ready');
  });

  it('isolerer per-række: to gyldige rækker er begge ready, og aggregatet er ready', () => {
    const reader = buildReaderForRows([createRow('r1'), createRow('r2')], '2024-12-31');
    const projection = buildRenteberegningReaderProjection({
      reader, referenceRates, surchargeRates,
    });
    expect(projection.rowProjections.get('r1')?.status).toBe('ready');
    expect(projection.rowProjections.get('r2')?.status).toBe('ready');
    expect(projection.aggregateProjection.status).toBe('ready');
    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.value.pdfContexts.size).toBe(2);
  });

  it('en tom række indgår ikke i aggregatets pdfContexts eller anyRowHasError', () => {
    const emptyRow: RentekravRow = { id: 'r-empty', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage' };
    const reader = buildReaderForRows([createRow('r1'), emptyRow], '2024-12-31');
    const projection = buildRenteberegningReaderProjection({
      reader, referenceRates, surchargeRates,
    });
    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.value.pdfContexts.size).toBe(1);
    expect(projection.aggregateProjection.value.anyRowHasError).toBe(false);
  });

  it('bevarer en delvist udfyldt rentekravsrække som input uden at opfinde en partnerfeltfejl', () => {
    const reader = buildReaderForRows([createRow('r1', { renterFra: undefined })], '2024-12-31');

    expect(reader.hasEntityInput(rentekravRowsCollectionRef, 'r1')).toBe(true);
  });

  it('behandler alene afvist råtekst som rækkeinput uden at lade den indgå i beregning', () => {
    const input = catalog.validateSettledInput({
      sections: {
        stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
        renteberegning: {
          beregningsdato: toISODateString('2024-12-31'),
          kommentarer: undefined,
          rentekravRows: [{ ...createRow('r1'), belob: undefined }],
        },
        varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
      },
      rejectedInputs: {
        [serializeFieldAddress(rentekravBelobField.bind('r1').address)]: { raw: 'abc', reason: 'format' },
      },
    });
    const reader = createInputEvaluation({
      input,
      catalog,
      sourceToken: createEvaluationSourceToken(createInputRevision(2), createSettingsRevision(2)),
    }).reader;

    expect(reader.hasEntityInput(rentekravRowsCollectionRef, 'r1')).toBe(true);
    expect(readRentekravCommittedRows(reader)).toEqual([{
      ...createRow('r1'),
      belob: undefined,
    }]);
    const projection = buildRenteberegningReaderProjection({ reader, referenceRates, surchargeRates });
    expect(projection.rowProjections.get('r1')?.status).not.toBe('ready');
  });

  it('rekonstruerer canonical rækker og bevarer tomme partnerfelter som undefined', () => {
    const rows: RentekravRow[] = [
      createRow('r1', { tillaegstid: 2, enhed: 'uger' }),
      { id: 'r-empty', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage' },
    ];
    const reader = buildReaderForRows(rows, '2024-12-31');

    expect(readRentekravCommittedRows(reader)).toEqual(rows);
  });

  it('regner rejected råtekst som afsluttet rentekravsinput', () => {
    const input = catalog.validateSettledInput({
      sections: {
        stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
        renteberegning: {
          beregningsdato: toISODateString('2024-12-31'),
          kommentarer: undefined,
          rentekravRows: [{ ...createRow('r1'), belob: undefined }],
        },
        varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
      },
      rejectedInputs: {
        [serializeFieldAddress(rentekravBelobField.bind('r1').address)]: { raw: 'abc', reason: 'format' },
      },
    });
    const reader = createInputEvaluation({
      input,
      catalog,
      sourceToken: createEvaluationSourceToken(createInputRevision(3), createSettingsRevision(3)),
    }).reader;

    expect(hasAnyRentekravInput(reader)).toBe(true);
  });

  it('regner en helt tom rentekravsrække som ingen afsluttet input', () => {
    const reader = buildReaderForRows([{
      id: 'r-empty', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage',
    }], '2024-12-31');

    expect(hasAnyRentekravInput(reader)).toBe(false);
  });

  it('blokerer aggregatet og rapporterer, når en ready rækkeprojektion forsvinder', () => {
    const reader = buildReaderForRows([createRow('r1')], '2024-12-31');
    const originalMapGet = Map.prototype.get;
    const mapGetSpy = vi.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<unknown, unknown>, key: unknown) {
      // Den interne aggregatprojektion slår kun denne række op i den map, vi vil simulere som
      // inkonsistent. Andre map-opslag skal fortsat bruge den normale implementation.
      if (key === 'r1') return undefined;
      return originalMapGet.call(this, key);
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const projection = buildRenteberegningReaderProjection({
        reader, referenceRates, surchargeRates,
      });
      expect(projection.aggregateProjection.status).toBe('ready');
      if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
      expect(projection.aggregateProjection.value).toEqual({
        pdfContexts: new Map(),
        anyRowHasError: true,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Renteaggregat mangler ready rækkeprojektion for r1.'
      );
    } finally {
      mapGetSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});

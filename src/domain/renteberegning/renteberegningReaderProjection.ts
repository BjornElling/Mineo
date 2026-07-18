import type { RateEntry } from '../../data/interestRates';
import {
  renteberegningBeregningsdatoField,
  rentekravBelobField,
  rentekravEnhedField,
  rentekravRenterFraField,
  rentekravRowsCollectionRef,
  rentekravTillaegstidField,
} from '../../inputCore/catalog/renteberegningDescriptors';
import type { InputReader } from '../../inputCore/inputReader';
import { runProjection, type ProjectionCollector, type ProjectionResult } from '../../inputCore/projection';
import type { RentekravRow } from '../../schemas/formSchemas';
import { computeRentekravRow, type RentekravRowResult } from './renteberegningEngine';
import { isRentekravRowEmpty } from './rowEmpty';

// Rækkeafhængighed udtrykkes ved de refs, den konkrete projektion læser. Der findes derfor ingen parallel
// global/row-scope-model eller manuelt opbyggede blockers ved siden af inputkernens issue-model.

export type RenteAggregateProjectionData = Readonly<{
  pdfContexts: ReadonlyMap<string, NonNullable<RentekravRowResult['pdfContext']>>;
  anyRowHasError: boolean;
}>;

export type RenteberegningReaderProjection = Readonly<{
  rowProjections: ReadonlyMap<string, ProjectionResult<RentekravRowResult>>;
  aggregateProjection: ProjectionResult<RenteAggregateProjectionData>;
}>;

const readRow = (collector: ProjectionCollector, rowId: string): RentekravRow | undefined => {
  const belob = collector.optional(rentekravBelobField.bind(rowId));
  const renterFra = collector.optional(rentekravRenterFraField.bind(rowId));
  const tillaegstid = collector.optional(rentekravTillaegstidField.bind(rowId));
  const enhed = collector.optional(rentekravEnhedField.bind(rowId));
  if (
    belob.status === 'unavailable'
    || renterFra.status === 'unavailable'
    || tillaegstid.status === 'unavailable'
    || enhed.status === 'unavailable'
  ) return undefined;
  return {
    id: rowId,
    belob: belob.value,
    renterFra: renterFra.value,
    tillaegstid: tillaegstid.value,
    enhed: enhed.value ?? 'dage',
  };
};

const computeRow = (
  collector: ProjectionCollector,
  rowId: string,
  referenceRates: ReadonlyArray<RateEntry>,
  surchargeRates: ReadonlyArray<RateEntry>
): RentekravRowResult | undefined => {
  const beregningsdato = collector.optional(renteberegningBeregningsdatoField.bind());
  const row = readRow(collector, rowId);
  if (beregningsdato.status === 'unavailable' || row === undefined) return undefined;
  return computeRentekravRow(row, beregningsdato.value, referenceRates, surchargeRates);
};

/** Læser de afsluttede rækker til tabelvisning og sortering gennem samme readergrænse. */
export const readRentekravCommittedRows = (reader: InputReader): RentekravRow[] =>
  reader.listEntities(rentekravRowsCollectionRef).map(({ entityId }) => {
    const belob = reader.read(rentekravBelobField.bind(entityId));
    const renterFra = reader.read(rentekravRenterFraField.bind(entityId));
    const tillaegstid = reader.read(rentekravTillaegstidField.bind(entityId));
    const enhed = reader.read(rentekravEnhedField.bind(entityId));
    return {
      id: entityId,
      belob: belob.status === 'usable' ? belob.value : undefined,
      renterFra: renterFra.status === 'usable' ? renterFra.value : undefined,
      tillaegstid: tillaegstid.status === 'usable' ? tillaegstid.value : undefined,
      enhed: enhed.status === 'usable' ? enhed.value : 'dage',
    };
  });

export const buildRenteberegningReaderProjection = (args: Readonly<{
  reader: InputReader;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
}>): RenteberegningReaderProjection => {
  const { reader, referenceRates, surchargeRates } = args;
  const rowIds = reader.listEntities(rentekravRowsCollectionRef).map(({ entityId }) => entityId);
  const rowProjections = new Map<string, ProjectionResult<RentekravRowResult>>();
  for (const rowId of rowIds) {
    rowProjections.set(
      rowId,
      runProjection(reader, `renteberegning.row.${rowId}`, (collector) =>
        computeRow(collector, rowId, referenceRates, surchargeRates))
    );
  }

  const aggregateProjection = runProjection(
    reader,
    'renteberegning.aggregate',
    (collector): RenteAggregateProjectionData | undefined => {
      // Aggregatet afhænger også af beregningsdatoen, når tabellen er tom.
      const beregningsdato = collector.optional(renteberegningBeregningsdatoField.bind());
      const rows = rowIds.map((rowId) => readRow(collector, rowId));
      if (beregningsdato.status === 'unavailable' || rows.some((row) => row === undefined)) return undefined;

      const pdfContexts = new Map<string, NonNullable<RentekravRowResult['pdfContext']>>();
      let anyRowHasError = false;
      for (const row of rows) {
        if (row === undefined) continue;
        const result = computeRentekravRow(row, beregningsdato.value, referenceRates, surchargeRates);
        if (isRentekravRowEmpty(row)) continue;
        if (result.pdfContext === null) anyRowHasError = true;
        else pdfContexts.set(row.id, result.pdfContext);
      }
      return { pdfContexts, anyRowHasError };
    }
  );

  return Object.freeze({ rowProjections, aggregateProjection });
};

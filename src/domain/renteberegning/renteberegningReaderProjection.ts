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
import {
  mapReadyProjection,
  runProjection,
  type ProjectionCollector,
  type ProjectionResult,
} from '../../inputCore/projection';
import type { ISODateString } from '../../types/branded';
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

/**
 * Motorinputtet for én række — INGEN motorkald. `runProjection`-kroppen udføres, FØR collectorens status er
 * afgjort (`inputCore/projection.ts`), så et motorkald her ville køre, selv når projektionen ender `blocked`.
 * Beregningen sker derfor bagefter gennem `mapReadyProjection`.
 */
type RowEngineInput = Readonly<{ row: RentekravRow; beregningsdato: ISODateString | undefined }>;

/** Aggregatets motorinput: alle læsbare rækker + den tværgående beregningsdato. Intet motorkald. */
type AggregateEngineInput = Readonly<{
  rows: readonly RentekravRow[];
  beregningsdato: ISODateString | undefined;
}>;

const readRowEngineInput = (
  collector: ProjectionCollector,
  rowId: string
): RowEngineInput | undefined => {
  const beregningsdato = collector.optional(renteberegningBeregningsdatoField.bind());
  const row = readRow(collector, rowId);
  if (beregningsdato.status === 'unavailable' || row === undefined) return undefined;
  return { row, beregningsdato: beregningsdato.value };
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
    // Trin 1: læs motorinput og afgør ready|blocked. Trin 2: kald motoren KUN i ready-grenen (§3.9).
    // Motoren ligger BEVIDST uden for `runProjection`-kroppen: kroppen udføres, før statussen er afgjort.
    rowProjections.set(rowId, mapReadyProjection(
      runProjection(reader, `renteberegning.row.${rowId}`, (collector) => readRowEngineInput(collector, rowId)),
      ({ row, beregningsdato }) => computeRentekravRow(row, beregningsdato, referenceRates, surchargeRates)
    ));
  }

  const aggregateProjection = mapReadyProjection(
    runProjection(
      reader,
      'renteberegning.aggregate',
      (collector): AggregateEngineInput | undefined => {
        // Aggregatet afhænger også af beregningsdatoen, når tabellen er tom.
        const beregningsdato = collector.optional(renteberegningBeregningsdatoField.bind());
        const rows = rowIds.map((rowId) => readRow(collector, rowId));
        if (beregningsdato.status === 'unavailable') return undefined;
        const usableRows = rows.filter((row): row is RentekravRow => row !== undefined);
        if (usableRows.length !== rows.length) return undefined;
        return { rows: usableRows, beregningsdato: beregningsdato.value };
      }
    ),
    ({ rows }): RenteAggregateProjectionData => {
      const pdfContexts = new Map<string, NonNullable<RentekravRowResult['pdfContext']>>();
      let anyRowHasError = false;
      for (const row of rows) {
        const rowProjection = rowProjections.get(row.id);
        // Aggregatet beholder sin egen dependency-gate ovenfor. Når den er ready, skal den tilsvarende
        // rækkeprojektion være ready på præcis de samme felter; en afvigelse er en intern invariantfejl,
        // som skal blokere dokumentet frem for at udløse en skjult anden beregningssti.
        if (rowProjection?.status !== 'ready') {
          console.error(`Renteaggregat mangler ready rækkeprojektion for ${row.id}.`);
          anyRowHasError = true;
          continue;
        }
        const result = rowProjection.value;
        if (isRentekravRowEmpty(row)) continue;
        if (result.pdfContext === null) anyRowHasError = true;
        else pdfContexts.set(row.id, result.pdfContext);
      }
      return { pdfContexts, anyRowHasError };
    }
  );

  return Object.freeze({ rowProjections, aggregateProjection });
};

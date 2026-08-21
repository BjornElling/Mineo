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
import type { FieldIssue } from '../../inputCore/inputIssue';
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

export type RentekravRowRuleIssues = Readonly<{
  belob?: FieldIssue;
  renterFra?: FieldIssue;
}>;

export type RenteberegningReaderProjection = Readonly<{
  rowProjections: ReadonlyMap<string, ProjectionResult<RentekravRowResult>>;
  rowRuleIssues: ReadonlyMap<string, RentekravRowRuleIssues>;
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
 * Motorinputtet for én række – INGEN motorkald. `runProjection`-kroppen udføres, FØR collectorens status er
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

/**
 * Om rentetabellen indeholder afsluttet brugerinput – også rejected råtekst.
 *
 * En `RentekravRow` er en beregningsprojektion og skjuler med vilje rejected felter som `undefined`.
 * Den må derfor ikke bruges til at afgøre, om den destruktive «Slet alle»-handling skal være aktiv; ellers
 * kan en række med den eneste fejlende indtastning blive umulig at rydde uden at rette fejlen først.
 */
export const hasAnyRentekravInput = (reader: InputReader): boolean =>
  reader.listEntities(rentekravRowsCollectionRef).some(({ entityId }) => hasAnyRentekravRowInput(reader, entityId));

/** En række med rejected råtekst er stadig brugerinput, selv om projektionen skjuler feltværdien. */
export const hasAnyRentekravRowInput = (reader: InputReader, rowId: string): boolean => {
  const belob = reader.read(rentekravBelobField.bind(rowId));
  const renterFra = reader.read(rentekravRenterFraField.bind(rowId));
  const tillaegstid = reader.read(rentekravTillaegstidField.bind(rowId));
  return [belob, renterFra, tillaegstid].some((result) => (
    result.status === 'error' || result.value !== undefined
  ));
};

/**
 * Afleder den rækkeinterne parregel uden at gøre et tomt felt rejected.
 *
 * Et rentekrav med kun beløb eller kun startdato er ikke beregningsklart, men tomhed er normalt ikke
 * en rød feltfejl i inputkernen. Derfor leveres reglen som en afledt collection-issue til netop det
 * manglende felt. Det giver samme synlige rettested som en validator uden at ændre persistence/XOR-reglen.
 */
export const readRentekravRowRuleIssues = (reader: InputReader): ReadonlyMap<string, RentekravRowRuleIssues> => {
  const issues = new Map<string, RentekravRowRuleIssues>();
  for (const { entityId } of reader.listEntities(rentekravRowsCollectionRef)) {
    const belobField = rentekravBelobField.bind(entityId);
    const renterFraField = rentekravRenterFraField.bind(entityId);
    const belob = reader.read(belobField);
    const renterFra = reader.read(renterFraField);
    // En rejected værdi har allerede sin egen røde fejl. Den må ikke samtidig få en afledt
    // «manglende partner»-fejl, som ville skjule den egentlige rettelse på samme felt.
    if (belob.status === 'error' || renterFra.status === 'error') continue;
    const hasBelob = belob.status === 'usable' && belob.value !== undefined;
    const hasRenterFra = renterFra.status === 'usable' && renterFra.value !== undefined;
    if (hasBelob === hasRenterFra) continue;

    if (hasBelob) {
      const issue: FieldIssue = Object.freeze({
        kind: 'field',
        code: `renteberegning.rentekrav.${entityId}.pairing`,
        severity: 'error',
        field: renterFraField,
        reason: 'rule',
        message: `${reader.labelOf(renterFraField)} skal udfyldes, når ${reader.labelOf(belobField)} er udfyldt`,
      });
      issues.set(entityId, { renterFra: issue });
    } else {
      const issue: FieldIssue = Object.freeze({
        kind: 'field',
        code: `renteberegning.rentekrav.${entityId}.pairing`,
        severity: 'error',
        field: belobField,
        reason: 'rule',
        message: `${reader.labelOf(belobField)} skal udfyldes, når ${reader.labelOf(renterFraField)} er udfyldt`,
      });
      issues.set(entityId, { belob: issue });
    }
  }
  return issues;
};

export const buildRenteberegningReaderProjection = (args: Readonly<{
  reader: InputReader;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
}>): RenteberegningReaderProjection => {
  const { reader, referenceRates, surchargeRates } = args;
  const rowIds = reader.listEntities(rentekravRowsCollectionRef).map(({ entityId }) => entityId);
  const rowRuleIssues = readRentekravRowRuleIssues(reader);
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

  return Object.freeze({ rowProjections, rowRuleIssues, aggregateProjection });
};

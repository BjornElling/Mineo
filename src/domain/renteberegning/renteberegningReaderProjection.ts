import type { RateEntry } from '../../data/interestRates';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { InputReader } from '../../inputCore/inputReader';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import {
  renteberegningBeregningsdatoField,
  rentekravRowsCollectionRef,
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravTillaegstidField,
  rentekravEnhedField,
} from '../../inputCore/catalog/renteberegningDescriptors';
import {
  blockedInputProjection,
  globalScope,
  readyInputProjection,
  rowScope,
  type InputBlocker,
  type InputProjection,
} from '../inputIntegrity/inputBlocker';
import { computeRentekravRow, type RentekravRowResult } from './renteberegningEngine';
import { isRentekravRowEmpty } from './rowEmpty';

// Greenfield Renteberegning-projektion (§3.4/§5.4, Fase 3 Renteberegning-slice). En ALMINDELIG ren funktion over
// den offentlige `InputReader`, der erstatter den legacy `buildRenteberegningInputProjection` (som læste rå
// `invalidDrafts` + committede sektioner). Den er den ENE kanoniske projektion til både tabelvisning og alle
// rente-dokumentgates.
//
//  - Committede rækkeværdier læses gennem readeren (aldrig rå sektioner, §5.4). En rød feltfejl (rejected
//    format/range) skjules af readeren → cellen falder tilbage til sin tomværdi, præcis som legacy maskerede den.
//  - En rød feltfejl bliver en scope-bærende `InputBlocker` i STEDET for `invalidDrafts`: beregningsdato er
//    globalt (blokerer alt), en rentekrav-celle er per-række (§1.10 — blokerer kun den rækkes output + aggregater).
//  - En blokeret række beregnes bevidst ikke, så en tidligere canonical værdi bag masken aldrig når motoren.
//  - `computeRentekravRow` køres UÆNDRET på de reader-rekonstruerede rækker → nul talændring (§5.4 hårdt stop).

const beregningsdatoRef: FieldRef<ISODateString | undefined> = renteberegningBeregningsdatoField.bind();

/** Brugervendte celle-labels til den centrale blocker-besked (spejler legacy `RENTE_CELL_COLUMN_LABELS`). */
const CELL_COLUMN_LABEL = {
  belob: 'Beløb',
  renterFra: 'Renter fra',
  tillaegstid: 'Tillægstid',
} as const;

export type RenteAggregateProjectionData = Readonly<{
  pdfContexts: ReadonlyMap<string, NonNullable<RentekravRowResult['pdfContext']>>;
  anyRowHasError: boolean;
}>;

export type RenteberegningReaderProjection = Readonly<{
  revision: number;
  /** Alle aktive røde feltfejl som scope-bærende blockers (global + per-række). */
  blockers: readonly InputBlocker[];
  /** Om den globale beregningsdato aktuelt har en rød feltfejl. */
  beregningsdatoHasError: boolean;
  rowProjections: ReadonlyMap<string, InputProjection<RentekravRowResult>>;
  aggregateProjection: InputProjection<RenteAggregateProjectionData>;
}>;

/** Rekonstruerer én committed rentekrav-række (ikke-blokerende) fra readeren i den afsluttede rækkefølge. */
const readCommittedRow = (reader: InputReader, rowId: string): RentekravRow => {
  const belob = reader.read(rentekravBelobField.bind(rowId));
  const renterFra = reader.read(rentekravRenterFraField.bind(rowId));
  const tillaegstid = reader.read(rentekravTillaegstidField.bind(rowId));
  const enhed = reader.read(rentekravEnhedField.bind(rowId));
  return {
    id: rowId,
    belob: belob.status === 'usable' ? belob.value : undefined,
    renterFra: renterFra.status === 'usable' ? renterFra.value : undefined,
    tillaegstid: tillaegstid.status === 'usable' ? tillaegstid.value : undefined,
    // enhed er required-choice med tomværdi 'dage'; readeren giver aldrig undefined for et gyldigt felt, men
    // fald tilbage til 'dage', hvis readeren skjuler en (umulig) fejl.
    enhed: enhed.status === 'usable' && enhed.value !== undefined ? enhed.value : 'dage',
  };
};

/** Rekonstruerer alle committede rentekrav-rækker (ikke-blokerende) fra readeren. */
export const readRentekravCommittedRows = (reader: InputReader): RentekravRow[] => {
  const rowIds = reader.listEntities(rentekravRowsCollectionRef).map((entity) => entity.entityId);
  return rowIds.map((rowId) => readCommittedRow(reader, rowId));
};

/**
 * Bygger den kanoniske reader-afledte projektion. `beregningsdato` gates globalt; hver rentekrav-celle gates
 * per-række. Kun `ready`-rækker føres til beregningsmotoren.
 */
export const buildRenteberegningReaderProjection = (args: Readonly<{
  reader: InputReader;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
  revision: number;
}>): RenteberegningReaderProjection => {
  const { reader, referenceRates, surchargeRates, revision } = args;

  const blockers: InputBlocker[] = [];

  // Global: beregningsdato. En rød feltfejl her blokerer ALLE downloads (aggregat + hver række, §1.10 — en
  // global blocker er relevant for hver rækkes per-række-output, jf. legacy `blockersForScope`).
  const beregningsdatoRead = reader.read(beregningsdatoRef);
  const beregningsdatoHasError = beregningsdatoRead.status === 'error';
  const beregningsdatoBlocker: InputBlocker | null = beregningsdatoHasError
    ? {
        fieldId: 'renteberegning.beregningsdato',
        fieldLabel: 'Beregningsdato',
        reason: 'invalid',
        scope: globalScope(),
        controlKind: 'text',
      }
    : null;
  if (beregningsdatoBlocker !== null) blockers.push(beregningsdatoBlocker);
  const beregningsdato = beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined;

  const rowIds = reader.listEntities(rentekravRowsCollectionRef).map((entity) => entity.entityId);
  const rowProjections = new Map<string, InputProjection<RentekravRowResult>>();
  const pdfContexts = new Map<string, NonNullable<RentekravRowResult['pdfContext']>>();
  let anyRowHasError = false;

  for (const rowId of rowIds) {
    // Per-række røde feltfejl (belob/renterFra/tillaegstid). enhed er required-choice → aldrig rød.
    const rowBlockers: InputBlocker[] = [];
    const recordCellBlocker = <T>(column: keyof typeof CELL_COLUMN_LABEL, ref: FieldRef<T>): void => {
      if (reader.read(ref).status !== 'error') return;
      rowBlockers.push({
        fieldId: `renteberegning.rentekravRows.${rowId}.${column}`,
        fieldLabel: CELL_COLUMN_LABEL[column],
        reason: 'invalid',
        scope: rowScope(rowId),
        controlKind: 'text',
      });
    };
    recordCellBlocker('belob', rentekravBelobField.bind(rowId));
    recordCellBlocker('renterFra', rentekravRenterFraField.bind(rowId));
    recordCellBlocker('tillaegstid', rentekravTillaegstidField.bind(rowId));

    if (rowBlockers.length > 0 || beregningsdatoBlocker !== null) {
      // En global fejl blokerer også hver enkelt rækkes per-række-output (§1.10 — aggregatet, der inkluderer
      // rækken, er allerede blokeret; den enkelte rækkes download afhænger også af beregningsdato).
      const combined = [...rowBlockers, ...(beregningsdatoBlocker !== null ? [beregningsdatoBlocker] : [])];
      blockers.push(...rowBlockers);
      rowProjections.set(rowId, blockedInputProjection(combined, revision));
      continue;
    }

    const committedRow = readCommittedRow(reader, rowId);
    const result = computeRentekravRow(committedRow, beregningsdato, referenceRates, surchargeRates);
    rowProjections.set(rowId, readyInputProjection(result, revision));
    if (isRentekravRowEmpty(committedRow)) continue;
    if (result.pdfContext === null) {
      anyRowHasError = true;
    } else {
      pdfContexts.set(rowId, result.pdfContext);
    }
  }

  const aggregateProjection = blockers.length > 0
    ? blockedInputProjection<RenteAggregateProjectionData>(blockers, revision)
    : readyInputProjection({ pdfContexts, anyRowHasError }, revision);

  return { revision, blockers, beregningsdatoHasError, rowProjections, aggregateProjection };
};

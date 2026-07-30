import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { InputReader } from '../../inputCore/inputReader';
import { bindCollectionCell } from '../../inputCore/react/cellSpecBuilder';
import {
  getStandardLoenTableValidation,
  type StandardLoenTableValidationResult,
} from '../../domain/aarsloen/standardLoenTableValidation';

// Parametrisering af den delte StandardLoenTable: hvert domæne ejer sine konkrete DESCRIPTORER + sin
// collection, mens rekonstruktionen og cellefejl-indsamlingen er FÆLLES.
//
// Tidligere implementerede hvert domæne også `readRows` og `resolveValidation` — to næsten identiske
// reader-adaptere (Årsløn + EO), hvis eneste forskel var, om cellen bindes med `(rowId)` eller
// `(ejerId, rowId)`. Forskellen er unødvendig: ejer-id'erne står i collectionens egen sti, præcis
// som `cellSpecBuilder` udleder dem. Begge afledninger er derfor nu generiske over feltsættet, og der findes
// ÉT sted, hvor en løntabelrække rekonstrueres, og ÉT sted, hvor dens cellefejl samles.

/** Descriptorerne for løntabellens redigerbare celler i en konkret collection-kontekst. */
export type StandardLoenTableFieldSet = Readonly<{
  collection: CollectionRef;
  col0_maaned: FieldDescriptor<string | undefined>;
  col1_maaned: FieldDescriptor<string | undefined>;
  col0_uge: FieldDescriptor<string | undefined>;
  col1_uge: FieldDescriptor<string | undefined>;
  col0_dag: FieldDescriptor<ISODateString | undefined>;
  col1_dag: FieldDescriptor<ISODateString | undefined>;
  col2: FieldDescriptor<AmountValue | undefined>;
  col3: FieldDescriptor<AmountValue | undefined>;
  col4: FieldDescriptor<AmountValue | undefined>;
  col5: FieldDescriptor<AmountValue | undefined>;
  fpFvShSoBeloeb: FieldDescriptor<AmountValue | undefined>;
  pensionBeloeb: FieldDescriptor<AmountValue | undefined>;
  /** Opret en fuldt schemaformet tom række for collectionen. */
  createRow: (id: string) => StandardLoenTableRow;
}>;

/**
 * Binder en celle gennem den DELTE `bindCollectionCell` — samme regel, celleditoren bruger.
 *
 * At de to deler udtryk er ikke kosmetik: cellen skal LÆSES på præcis den adresse, den REDIGERES på.
 * Divergerede de, ville brugeren skrive i en celle, hvis værdi rekonstruktionen aldrig fandt — en lydløst
 * tom celle. Det er også grunden til, at de to reader-adaptere kunne samles: en top-level
 * collection giver `[]` ejere → `bind(rowId)`, en nested giver `[ejerId]` → `bind(ejerId, rowId)`.
 */
const bindCell = <T>(
  fieldSet: StandardLoenTableFieldSet,
  descriptor: FieldDescriptor<T>,
  rowId: string
) => bindCollectionCell(fieldSet.collection, descriptor, rowId);

/** Ikke-blokerende read: canonical værdi eller feltets tomværdi (skjult rød fejl / null-sektion → tomværdi). */
const readCell = <T>(
  reader: InputReader,
  fieldSet: StandardLoenTableFieldSet,
  descriptor: FieldDescriptor<T>,
  rowId: string
): T => {
  const result = reader.read(bindCell(fieldSet, descriptor, rowId));
  const emptyValue = descriptor.emptyValue;
  if (result.status !== 'usable') return emptyValue;
  return result.value === undefined && emptyValue !== undefined ? emptyValue : result.value;
};

/** Rekonstruerer én løntabelrække eksplicit, så en schemaændring giver en typefejl frem for et usikkert cast. */
const rebuildRow = (
  reader: InputReader,
  fieldSet: StandardLoenTableFieldSet,
  rowId: string
): StandardLoenTableRow => ({
  id: rowId,
  col0_maaned: readCell(reader, fieldSet, fieldSet.col0_maaned, rowId),
  col1_maaned: readCell(reader, fieldSet, fieldSet.col1_maaned, rowId),
  col0_uge: readCell(reader, fieldSet, fieldSet.col0_uge, rowId),
  col1_uge: readCell(reader, fieldSet, fieldSet.col1_uge, rowId),
  col0_dag: readCell(reader, fieldSet, fieldSet.col0_dag, rowId),
  col1_dag: readCell(reader, fieldSet, fieldSet.col1_dag, rowId),
  col2: readCell(reader, fieldSet, fieldSet.col2, rowId),
  col3: readCell(reader, fieldSet, fieldSet.col3, rowId),
  col4: readCell(reader, fieldSet, fieldSet.col4, rowId),
  col5: readCell(reader, fieldSet, fieldSet.col5, rowId),
  fpFvShSoBeloeb: readCell(reader, fieldSet, fieldSet.fpFvShSoBeloeb, rowId),
  pensionBeloeb: readCell(reader, fieldSet, fieldSet.pensionBeloeb, rowId),
});

const rowIdsFor = (fieldSet: StandardLoenTableFieldSet, reader: InputReader): readonly string[] =>
  reader.listEntities(fieldSet.collection).map((entity) => entity.entityId);

/** Rekonstruér de committede rækker (read-only) i afsluttet rækkefølge. */
export const readStandardLoenTableRows = (
  fieldSet: StandardLoenTableFieldSet,
  reader: InputReader
): StandardLoenTableRow[] =>
  rowIdsFor(fieldSet, reader).map((rowId) => rebuildRow(reader, fieldSet, rowId));

/**
 * Kolonneindeks pr. rækkecelle: periodekolonnerne 0/1 for den AKTUELLE lønperiode; beløb 2–5; tillægsbeløb
 * 6/7 kun i Beløb-tilstand. Kun de relevante kolonner læses (§1.9: en skjult/irrelevant celle må ikke
 * overblokere).
 */
const collectCellErrorsByCellKey = (
  reader: InputReader,
  fieldSet: StandardLoenTableFieldSet,
  rowIds: readonly string[],
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): Record<string, true> => {
  const cellErrors: Record<string, true> = {};
  const record = <T>(rowId: string, colIndex: number, descriptor: FieldDescriptor<T>): void => {
    if (reader.read(bindCell(fieldSet, descriptor, rowId)).status === 'error') {
      cellErrors[`${rowId}:${colIndex}`] = true;
    }
  };

  // Periodekolonnerne har forskellig VÆRDITYPE pr. lønperiode (uge/måned er strenge, dag er en branded ISO-
  // dato), så de to registreringer sker inde i hver gren. Et fælles union-array ville tvinge et cast.
  const recordPeriodCells = (rowId: string): void => {
    if (loenperiode === 'maaned') {
      record(rowId, 0, fieldSet.col0_maaned);
      record(rowId, 1, fieldSet.col1_maaned);
    } else if (loenperiode === 'uge') {
      record(rowId, 0, fieldSet.col0_uge);
      record(rowId, 1, fieldSet.col1_uge);
    } else {
      record(rowId, 0, fieldSet.col0_dag);
      record(rowId, 1, fieldSet.col1_dag);
    }
  };

  for (const rowId of rowIds) {
    recordPeriodCells(rowId);
    record(rowId, 2, fieldSet.col2);
    record(rowId, 3, fieldSet.col3);
    record(rowId, 4, fieldSet.col4);
    record(rowId, 5, fieldSet.col5);
    if (tillaegAngivesSom === 'beloeb') {
      record(rowId, 6, fieldSet.fpFvShSoBeloeb);
      record(rowId, 7, fieldSet.pensionBeloeb);
    }
  }
  return cellErrors;
};

/** Reader-afledt valideringssummary + errors. Den ENE kilde til løntabellens summary (§2.5/§3.4). */
export const resolveStandardLoenTableValidationFromReader = (
  fieldSet: StandardLoenTableFieldSet,
  reader: InputReader,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): StandardLoenTableValidationResult => {
  const rowIds = rowIdsFor(fieldSet, reader);
  const rows = rowIds.map((rowId) => rebuildRow(reader, fieldSet, rowId));
  const cellErrorsByCellKey = collectCellErrorsByCellKey(reader, fieldSet, rowIds, loenperiode, tillaegAngivesSom);
  return getStandardLoenTableValidation({ rows, loenperiode, cellErrorsByCellKey, tillaegAngivesSom });
};

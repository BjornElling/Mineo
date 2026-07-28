import type { Loenperiode, StandardLoenTableRow, TillaegAngivesSom } from '../../schemas/formSchemas';
import { createCollectionRef, type CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { InputReader } from '../../inputCore/inputReader';
import { eoStandardRowFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import { getStandardLoenTableValidation, type StandardLoenTableValidationResult } from '../aarsloen/standardLoenTableValidation';
import { createEmptyStandardLoenRow } from '../aarsloen/standardLoenRowInitialValues';
import type { StandardLoenTableFieldSet } from '../../components/tables/standardLoenTableFieldSet';

// EO-parametrisering af den delte StandardLoenTable. Løntabellen deles mellem Årsløn (top-level
// `aarsloen.tableData`) og EO's loenindkomst, hvor den ligger NESTED under hver ansættelsesforholds-række
// (`loenindkomstAnsaettelsesforhold[i].indtaegtsoplysningerTableData`).
//
// Feltsættet leverer den konkrete NESTED `collection` — som selv bærer ansættelsesforholdets entity-id — plus de
// rå celle-descriptorer. Descriptorerne er BEVIDST ubundne her: bindingen sker ét sted, i den fælles
// `buildCollectionCellSpec`, som udleder ejer-id'erne af `collection.path` (§3.2). Derfor kan et feltsæt ikke
// glemme ejeren, og en celles adresse er altid `field.bind(employmentId, rowId)` (§1.10 pr. række).

const S = 'erstatningsopgoerelse' as const;
const EMPLOYMENTS = 'loenindkomstAnsaettelsesforhold';
const STANDARD_ROWS = 'indtaegtsoplysningerTableData';

/** Den nested collection-ref for løntabellen under ét konkret ansættelsesforhold. */
export const eoStandardLoenCollectionRef = (employmentId: string): CollectionRef =>
  createCollectionRef({
    section: S,
    path: [{ kind: 'entity', collection: EMPLOYMENTS, entityId: employmentId }],
    collection: STANDARD_ROWS,
  });

/** Ikke-blokerende read: canonical værdi eller feltets tomværdi (skjult rød fejl / null-sektion → tomværdi). */
const readCell = <T>(reader: InputReader, descriptor: FieldDescriptor<T>, employmentId: string, rowId: string): T => {
  const result = reader.read(descriptor.bind(employmentId, rowId));
  const emptyValue = descriptor.emptyValue;
  if (result.status !== 'usable') return emptyValue;
  return result.value === undefined && emptyValue !== undefined ? emptyValue : result.value;
};

const readString = (reader: InputReader, descriptor: FieldDescriptor<string | undefined>, e: string, r: string) => readCell(reader, descriptor, e, r);
const readDate = (reader: InputReader, descriptor: FieldDescriptor<ISODateString | undefined>, e: string, r: string) => readCell(reader, descriptor, e, r);
const readAmount = (reader: InputReader, descriptor: FieldDescriptor<AmountValue | undefined>, e: string, r: string) => readCell(reader, descriptor, e, r);

/** Rekonstruerer én nested løntabelrække under et ansættelsesforhold (skjulte røde celler → tomværdi). */
const rebuildRow = (reader: InputReader, employmentId: string, rowId: string): StandardLoenTableRow => ({
  id: rowId,
  col0_maaned: readString(reader, eoStandardRowFields.col0_maaned, employmentId, rowId),
  col1_maaned: readString(reader, eoStandardRowFields.col1_maaned, employmentId, rowId),
  col0_uge: readString(reader, eoStandardRowFields.col0_uge, employmentId, rowId),
  col1_uge: readString(reader, eoStandardRowFields.col1_uge, employmentId, rowId),
  col0_dag: readDate(reader, eoStandardRowFields.col0_dag, employmentId, rowId),
  col1_dag: readDate(reader, eoStandardRowFields.col1_dag, employmentId, rowId),
  col2: readAmount(reader, eoStandardRowFields.col2, employmentId, rowId),
  col3: readAmount(reader, eoStandardRowFields.col3, employmentId, rowId),
  col4: readAmount(reader, eoStandardRowFields.col4, employmentId, rowId),
  col5: readAmount(reader, eoStandardRowFields.col5, employmentId, rowId),
  fpFvShSoBeloeb: readAmount(reader, eoStandardRowFields.fpFvShSoBeloeb, employmentId, rowId),
  pensionBeloeb: readAmount(reader, eoStandardRowFields.pensionBeloeb, employmentId, rowId),
});

/** Rekonstruerer løntabellens rækker (afsluttet rækkefølge) for ét ansættelsesforhold. */
export const readEoStandardLoenTableRows = (reader: InputReader, employmentId: string): StandardLoenTableRow[] => {
  const collection = eoStandardLoenCollectionRef(employmentId);
  return reader.listEntities(collection).map((entity) => rebuildRow(reader, employmentId, entity.entityId));
};

// Kolonneindeks pr. rækkecelle (matcher legacy `resolveColIdxFromKey`): periodekolonner 0/1 for den aktuelle
// lønperiode; beløb 2–5; tillægsbeløb 6/7 (kun redigerbare i Beløb-tilstand). Identisk med Årsløn-feltsættet.
const recordCellError = <T>(
  reader: InputReader,
  employmentId: string,
  rowId: string,
  colIndex: number,
  descriptor: FieldDescriptor<T>,
  target: Record<string, true>
): void => {
  if (reader.read(descriptor.bind(employmentId, rowId)).status === 'error') target[`${rowId}:${colIndex}`] = true;
};

const collectReaderCellErrorsByCellKey = (
  reader: InputReader,
  employmentId: string,
  rowIds: readonly string[],
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): Record<string, true> => {
  const cellErrors: Record<string, true> = {};
  for (const rowId of rowIds) {
    if (loenperiode === 'maaned') {
      recordCellError(reader, employmentId, rowId, 0, eoStandardRowFields.col0_maaned, cellErrors);
      recordCellError(reader, employmentId, rowId, 1, eoStandardRowFields.col1_maaned, cellErrors);
    } else if (loenperiode === 'uge') {
      recordCellError(reader, employmentId, rowId, 0, eoStandardRowFields.col0_uge, cellErrors);
      recordCellError(reader, employmentId, rowId, 1, eoStandardRowFields.col1_uge, cellErrors);
    } else {
      recordCellError(reader, employmentId, rowId, 0, eoStandardRowFields.col0_dag, cellErrors);
      recordCellError(reader, employmentId, rowId, 1, eoStandardRowFields.col1_dag, cellErrors);
    }
    recordCellError(reader, employmentId, rowId, 2, eoStandardRowFields.col2, cellErrors);
    recordCellError(reader, employmentId, rowId, 3, eoStandardRowFields.col3, cellErrors);
    recordCellError(reader, employmentId, rowId, 4, eoStandardRowFields.col4, cellErrors);
    recordCellError(reader, employmentId, rowId, 5, eoStandardRowFields.col5, cellErrors);
    if (tillaegAngivesSom === 'beloeb') {
      recordCellError(reader, employmentId, rowId, 6, eoStandardRowFields.fpFvShSoBeloeb, cellErrors);
      recordCellError(reader, employmentId, rowId, 7, eoStandardRowFields.pensionBeloeb, cellErrors);
    }
  }
  return cellErrors;
};

/** Reader-afledt valideringssummary for ét ansættelsesforholds løntabel (samme rene summary som Årsløn). */
export const resolveEoStandardLoenTableValidation = (
  reader: InputReader,
  employmentId: string,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): StandardLoenTableValidationResult => {
  const collection = eoStandardLoenCollectionRef(employmentId);
  const rowIds = reader.listEntities(collection).map((entity) => entity.entityId);
  const rows = rowIds.map((rowId) => rebuildRow(reader, employmentId, rowId));
  const cellErrorsByCellKey = collectReaderCellErrorsByCellKey(reader, employmentId, rowIds, loenperiode, tillaegAngivesSom);
  return getStandardLoenTableValidation({ rows, loenperiode, cellErrorsByCellKey, tillaegAngivesSom });
};

/**
 * Bygger StandardLoenTable-feltsættet for ét konkret ansættelsesforhold. Bruges af `AnsaettelsesforholdCard`;
 * strukturelt identisk med `aarsloenStandardLoenFieldSet` bortset fra ÉN ting: `collection` er den nested ref med
 * ansættelsesforholdets entity-id. Cellernes ejer-id'er kommer derfra — ikke fra en separat parameter.
 */
export const createEoStandardLoenFieldSet = (employmentId: string): StandardLoenTableFieldSet => ({
  collection: eoStandardLoenCollectionRef(employmentId),
  col0_maaned: eoStandardRowFields.col0_maaned,
  col1_maaned: eoStandardRowFields.col1_maaned,
  col0_uge: eoStandardRowFields.col0_uge,
  col1_uge: eoStandardRowFields.col1_uge,
  col0_dag: eoStandardRowFields.col0_dag,
  col1_dag: eoStandardRowFields.col1_dag,
  col2: eoStandardRowFields.col2,
  col3: eoStandardRowFields.col3,
  col4: eoStandardRowFields.col4,
  col5: eoStandardRowFields.col5,
  fpFvShSoBeloeb: eoStandardRowFields.fpFvShSoBeloeb,
  pensionBeloeb: eoStandardRowFields.pensionBeloeb,
  createRow: createEmptyStandardLoenRow,
  readRows: (reader) => readEoStandardLoenTableRows(reader, employmentId),
  resolveValidation: (reader, loenperiode, tillaegAngivesSom) =>
    resolveEoStandardLoenTableValidation(reader, employmentId, loenperiode, tillaegAngivesSom),
});

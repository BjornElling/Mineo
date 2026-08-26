import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import { toAnyFieldRef, type AnyFieldRef, type FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { InputReader } from '../../inputCore/inputReader';
import { bindCollectionCell } from '../../inputCore/react/cellSpecBuilder';
import {
  getStandardLoenPeriodKeys,
  getStandardLoenTableValidation,
  type StandardLoenTableValidationResult,
} from '../../domain/aarsloen/standardLoenTableValidation';
import { DUPLICATE_ROW_MESSAGE, findDuplicateRows } from '../../utils/tableDuplicateRowDetection';

// Parametrisering af den delte StandardLoenTable: hvert domæne ejer sine konkrete DESCRIPTORER + sin
// collection, mens rekonstruktionen og cellefejl-indsamlingen er FÆLLES.
//
// Tidligere implementerede hvert domæne også `readRows` og `resolveValidation` – to næsten identiske
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
 * Binder en celle gennem den DELTE `bindCollectionCell` – samme regel, celleditoren bruger.
 *
 * At de to deler udtryk er ikke kosmetik: cellen skal LÆSES på præcis den adresse, den REDIGERES på.
 * Divergerede de, ville brugeren skrive i en celle, hvis værdi rekonstruktionen aldrig fandt – en lydløst
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
  tillaegAngivesSom: TillaegAngivesSom,
  emptyCompletePeriodLevel: 'warning' | 'error' = 'warning'
): StandardLoenTableValidationResult => {
  const rowIds = rowIdsFor(fieldSet, reader);
  const rows = rowIds.map((rowId) => rebuildRow(reader, fieldSet, rowId));
  const cellErrorsByCellKey = collectCellErrorsByCellKey(reader, fieldSet, rowIds, loenperiode, tillaegAngivesSom);
  return getStandardLoenTableValidation({
    rows,
    loenperiode,
    cellErrorsByCellKey,
    tillaegAngivesSom,
    emptyCompletePeriodLevel,
  });
};

// ── Kryds-række-dubletter (brugerkrav 2026-08-26) ─────────────────────────────

/**
 * De celler, der indgår i dublet-sammenligningen for den AKTUELLE tilstand.
 *
 * Kun de RELEVANTE kolonner tæller med: den valgte lønperiodes to periodekolonner (en skjult måneds-værdi
 * må ikke afgøre, om to synligt ens uge-rækker er dubletter), og tillægsbeløbene kun i Beløb-tilstand, hvor
 * de er redigerbare. Det er samme relevans-afgrænsning, som `collectCellErrorsByCellKey` bruger.
 */
const duplicateComparableValues = (
  row: StandardLoenTableRow,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): readonly unknown[] => {
  const [periodStartKey, periodEndKey] = getStandardLoenPeriodKeys(loenperiode);
  const values: unknown[] = [row[periodStartKey], row[periodEndKey], row.col2, row.col3, row.col4, row.col5];
  if (tillaegAngivesSom === 'beloeb') {
    values.push(row.fpFvShSoBeloeb, row.pensionBeloeb);
  }
  return values;
};

/**
 * De kolonner, dublet-fejlen markerer. Hele rækken er gentagelsen, så markeringen sidder på ALLE de
 * sammenlignede celler frem for på én vilkårligt udvalgt – i modsætning til overlaps-reglen, hvor kun én af
 * to lovlige datoer ville blive udpeget som offer. Her er alle cellerne lige meget en del af dubletten.
 */
const duplicateMarkedCellRefs = (
  fieldSet: StandardLoenTableFieldSet,
  rowId: string,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): readonly Readonly<{ id: string; field: AnyFieldRef }>[] => {
  // Hver celle bindes med sin EGEN værditype bevaret; `toAnyFieldRef` udsletter typen først bagefter, så
  // der ikke er brug for et cast over de heterogene descriptor-typer (streng / ISO-dato / AmountValue).
  const cell = <T>(descriptor: FieldDescriptor<T>) => Object.freeze({
    id: descriptor.id,
    field: toAnyFieldRef(bindCell(fieldSet, descriptor, rowId)),
  });

  // Periodekolonnerne har forskellig værditype pr. lønperiode, så parret vælges i én gren frem for gennem
  // en nøgle-indeksering, der ville tvinge et cast over union-typen.
  const periodCells = loenperiode === 'maaned'
    ? [cell(fieldSet.col0_maaned), cell(fieldSet.col1_maaned)]
    : loenperiode === 'uge'
      ? [cell(fieldSet.col0_uge), cell(fieldSet.col1_uge)]
      : [cell(fieldSet.col0_dag), cell(fieldSet.col1_dag)];

  const refs = [...periodCells, cell(fieldSet.col2), cell(fieldSet.col3), cell(fieldSet.col4), cell(fieldSet.col5)];
  if (tillaegAngivesSom === 'beloeb') {
    refs.push(cell(fieldSet.fpFvShSoBeloeb), cell(fieldSet.pensionBeloeb));
  }
  return refs;
};

/**
 * Løntabellens kryds-række-dubletter som kanoniske `FieldIssue`s.
 *
 * Reglen KAN ikke bo i en descriptor-validator: den sammenligner rækken med de forudgående rækker, og en
 * descriptor-validator ser kun sin egen celles værdi. Afledningen sker derfor samlet her – men resultatet
 * er strukturelt og bærer rækkens egne feltadresser, så rød ring, tooltip og fokusnavigation læser ÉN
 * repræsentation. Mønstret er `buildAslAfgoerelseRuleFieldIssues` i `erhvervsevnetabReaderProjection.ts`.
 *
 * Afledningen er generisk over feltsættet, så Årsløn og EO-lønindkomst deler den. I EO er feltsættet
 * bundet til ÉT ansættelsesforhold, hvorfor sammenligningen automatisk kun sker inden for det
 * ansættelsesforhold – to identiske rækker under to forskellige ansættelsesforhold er ikke en dublet.
 */
export const resolveStandardLoenDuplicateRowIssues = (
  fieldSet: StandardLoenTableFieldSet,
  rows: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): readonly FieldIssue[] => {
  const duplicates = findDuplicateRows(rows, (row) =>
    duplicateComparableValues(row, loenperiode, tillaegAngivesSom));
  if (duplicates.length === 0) return Object.freeze([]);

  const issues: FieldIssue[] = [];
  for (const { row } of duplicates) {
    for (const { id, field } of duplicateMarkedCellRefs(fieldSet, row.id, loenperiode, tillaegAngivesSom)) {
      issues.push(Object.freeze({
        kind: 'field' as const,
        code: `${id}.duplicateRow`,
        severity: 'error' as const,
        field,
        reason: 'rule' as const,
        message: DUPLICATE_ROW_MESSAGE,
      }));
    }
  }
  return Object.freeze(issues);
};

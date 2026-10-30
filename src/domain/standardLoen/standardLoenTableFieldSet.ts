import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import type { InputReader } from '../../inputCore/inputReader';
import { bindCollectionCell } from '../../inputCore/collectionCellBinding';
import {
  getStandardLoenTableValidation,
  type StandardLoenTableValidationResult,
} from './standardLoenTableValidation';

// Parametrisering af den delte StandardLoenTable: hvert domæne ejer sine konkrete DESCRIPTORER + sin
// collection, mens rekonstruktionen og cellefejl-indsamlingen er FÆLLES.
//
// Modulet er placeret i domænelaget, fordi readerprojektioner, validering og dokumentgates bruger det.
// Det indeholder ingen React-rendering; den faktiske tabelkomponent er kun en overflade over denne kerne.

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
  /**
   * De bundne satsfelter, tabellens afledte kolonner regnes med (feriegodtgørelse, fritvalg, SH/SO, Store Bededag og
   * pension – dem, siden har). Satserne bor uden for collectionen (Årslønnens skalarer, EO's ansættelsesforhold), så
   * de er bundne refs og ikke celle-descriptorer. Læses af `hasStandardLoenSatsFejl`.
   */
  satsRefs: readonly FieldRef<number | undefined>[];
  /** Opret en fuldt schemaformet tom række for collectionen. */
  createRow: (id: string) => StandardLoenTableRow;
}>;

/**
 * Binder en celle gennem den fælles inputkerne-primitive – samme adresse som celleditoren bruger.
 *
 * At de to deler udtryk er ikke kosmetik: cellen skal læses på præcis den adresse, den redigeres på.
 * Divergerede de, ville brugeren skrive i en celle, hvis værdi rekonstruktionen aldrig fandt – en lydløst
 * tom celle. Det er også grunden til, at de to reader-adaptere kunne samles.
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
): StandardLoenTableRow[] => rowIdsFor(fieldSet, reader).map((rowId) => rebuildRow(reader, fieldSet, rowId));

/**
 * Om tabellens satser er ukendte i en tilstand, hvor satserne læses (BB-099): en sats står med en rød fejl,
 * eller en påkrævet sats er tom (`paakraevetSatsMangler`, den fælles feriesatsregel M-37).
 *
 * Readeren skjuler en rød sats bag sin tomværdi, så rækkens afledte kolonner ellers ville blive regnet med satsen
 * som 0 % og vise et forkert tal ved siden af en sammentælling, der netop siger «kan ikke beregnes». Betingelsen er
 * den samme som Årslønnens feltgate (`resolveAarsloenFieldErrorGate`): en rød sats tæller, medmindre tillæggene
 * angives som beløb – dér læses satserne ikke. `paakraevetSatsMangler` leveres af fladens egen kravregel (Årsløn:
 * projektionens `feriePctMangler`; EO: satsvurderingens `missing`), så gaten og tabellen læser samme svar.
 */
export const hasStandardLoenSatsFejl = (
  reader: InputReader,
  fieldSet: StandardLoenTableFieldSet,
  tillaegAngivesSom: TillaegAngivesSom,
  options: Readonly<{ paakraevetSatsMangler?: boolean }> = {}
): boolean =>
  tillaegAngivesSom !== 'beloeb'
  && (options.paakraevetSatsMangler === true || fieldSet.satsRefs.some((ref) => reader.read(ref).status === 'error'));

/** Rækkens beløbsceller, der indgår i de afledte kolonner: løn 2–5 og, i Beløb-tilstand, tillægsbeløbene 6/7. */
const amountCellsFor = (
  fieldSet: StandardLoenTableFieldSet,
  tillaegAngivesSom: TillaegAngivesSom
): readonly (readonly [number, FieldDescriptor<AmountValue | undefined>])[] => [
  [2, fieldSet.col2],
  [3, fieldSet.col3],
  [4, fieldSet.col4],
  [5, fieldSet.col5],
  ...(tillaegAngivesSom === 'beloeb'
    ? [[6, fieldSet.fpFvShSoBeloeb], [7, fieldSet.pensionBeloeb]] as const
    : []),
];

/**
 * Om én af rækkens egne beløbsceller står med en rød fejl (BB-099, rækkeformen).
 *
 * Readeren læser den røde celle som tom, så rækkens «Samlet løn» ellers blev regnet uden den. Sammentællingen
 * regner ikke på en række med en `invalid`-celle; rækkens afledte kolonner viser da samme «—». Cellerne er de
 * samme, valideringen (`collectCellErrorsByCellKey`) læser. En rød periodecelle ændrer ikke rækkens beløb og
 * tæller derfor ikke her.
 */
export const hasStandardLoenRowBeloebFejl = (
  reader: InputReader,
  fieldSet: StandardLoenTableFieldSet,
  rowId: string,
  tillaegAngivesSom: TillaegAngivesSom
): boolean =>
  amountCellsFor(fieldSet, tillaegAngivesSom)
    .some(([, descriptor]) => reader.read(bindCell(fieldSet, descriptor, rowId)).status === 'error');

/**
 * Kolonneindeks pr. rækkecelle: periodekolonnerne 0/1 for den aktuelle lønperiode; beløb 2–5;
 * tillægsbeløb 6/7 kun i Beløb-tilstand. Kun de relevante kolonner læses (§1.9: en skjult/irrelevant
 * celle må ikke overblokere).
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

  // Periodekolonnerne har forskellig værditype pr. lønperiode (uge/måned er strenge, dag er en branded
  // dato), så registreringen sker inde i hver gren. Et fælles union-array ville tvinge et cast.
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
    for (const [colIndex, descriptor] of amountCellsFor(fieldSet, tillaegAngivesSom)) {
      record(rowId, colIndex, descriptor);
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

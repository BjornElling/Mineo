import type { AarsloenValues, Loenperiode, StandardLoenTableRow, TillaegAngivesSom } from '../../schemas/formSchemas';
import { createCollectionRef, type CollectionRef } from '../../inputCore/fieldAddress';
import {
  aarsloenAntalFeriedageField,
  aarsloenFeriePctField,
  aarsloenFritvalgPctField,
  aarsloenFuldLoenUnderFerieField,
  aarsloenLoenPaaHelligdageField,
  aarsloenLoenperiodeField,
  aarsloenOmregningTilFuldtAarField,
  aarsloenPensionPctField,
  aarsloenRetTilSjetteFerieugeField,
  aarsloenShSoPctField,
  aarsloenStoreBededagPctField,
  aarsloenTableCol0DagField,
  aarsloenTableCol0MaanedField,
  aarsloenTableCol0UgeField,
  aarsloenTableCol1DagField,
  aarsloenTableCol1MaanedField,
  aarsloenTableCol1UgeField,
  aarsloenTableCol2Field,
  aarsloenTableCol3Field,
  aarsloenTableCol4Field,
  aarsloenTableCol5Field,
  aarsloenTableFpFvShSoBeloebField,
  aarsloenTablePensionBeloebField,
  aarsloenTillaegAngivesSomField,
} from '../../inputCore/catalog/aarsloenDescriptors';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { InputReader } from '../../inputCore/inputReader';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { ProjectionResult } from '../../inputCore/projection';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import type { StamdataValues } from '../../schemas/formSchemas';
import { computeAarsloenBeregning, type AarsloenBeregningState } from '../../hooks/useAarsloenBeregning';
import { resolveAarsloenOmregningGate, type AarsloenOmregningGate } from './aarsloenValidationPolicies';
import { getStandardLoenTableValidation, type StandardLoenTableValidationResult } from './standardLoenTableValidation';

// Greenfield Årsløn-projektion (§3.4/§5.4, Fase 3 Årsløn-slice, Pass 1). En ALMINDELIG ren funktion over den
// offentlige `InputReader`, der genopbygger et komplet, schema-formet `AarsloenValues`-objekt fra readeren, så de
// EKSISTERENDE calc-hooks (`useAarsloenBeregning`, `useAarsloenDocumentGates`) kan køre UÆNDRET på det — nul
// talændring (§5.4 hårdt stop). Det er den sanktionerede fremflytning i §5.4: en migreret formular må ikke holde
// sin beregnings-/dokumentconsumer i live på rå sektioner, så consumeren fødes her gennem readeren i stedet.
//
// To komplementære reads (begge rene, ingen rå sektioner):
//  - `readAarsloenValues(reader)`: rekonstruerer `AarsloenValues` UDEN at blokere. En rød feltfejl (rejected
//    format/range) skjules af readeren, og cellen/feltet falder tilbage til sin tomværdi — præcis som legacy
//    læste den tomme/maskerede canonical værdi. Dette er kildeobjektet til både felt-rendering og calc-input.
//  - `resolveAarsloenFieldErrorGate(reader)`: samler de RØDE feltfejl på de felter, der i legacy var fatale
//    beregningsinput (satsprocenter + antalFeriedage). En sats uden for 0–100 er nu en rød feltfejl frem for
//    legacy's "Kritisk Fejl"-boks (§1.6: en rød feltfejl er en rød feltfejl — kun præsentationen ændres, ikke
//    beregningstallet), og den skjulte værdi må ikke give et misvisende beregnet resultat. Tabelcelle-fejl er
//    IKKE fatale (legacy isolerer pr. række, §1.10) og indgår derfor ikke i gaten.

const scalarRefs = {
  feriePct: aarsloenFeriePctField.bind(),
  fritvalgPct: aarsloenFritvalgPctField.bind(),
  shSoPct: aarsloenShSoPctField.bind(),
  storeBededagPct: aarsloenStoreBededagPctField.bind(),
  pensionPct: aarsloenPensionPctField.bind(),
  loenperiode: aarsloenLoenperiodeField.bind(),
  tillaegAngivesSom: aarsloenTillaegAngivesSomField.bind(),
  loenPaaHelligdage: aarsloenLoenPaaHelligdageField.bind(),
  omregningTilFuldtAar: aarsloenOmregningTilFuldtAarField.bind(),
  fuldLoenUnderFerie: aarsloenFuldLoenUnderFerieField.bind(),
  retTilSjetteFerieuge: aarsloenRetTilSjetteFerieugeField.bind(),
  antalFeriedage: aarsloenAntalFeriedageField.bind(),
} as const;

// tableData er en top-level collection (ingen entity-parent i stien).
const tableDataCollection: CollectionRef = createCollectionRef({
  section: 'aarsloen',
  path: [],
  collection: 'tableData',
});

/**
 * Ikke-blokerende read: canonical værdi eller feltets tomværdi. Falder tilbage til `emptyValue` både når værdien
 * er skjult bag en rød feltfejl OG når en null-sektion giver `undefined` for et felt, hvis tomværdi ikke er
 * `undefined` (fx en required-choice som loenperiode='maaned') — så defaulten svarer til descriptorens kontrakt.
 */
const readOrEmpty = <T>(reader: InputReader, field: FieldRef<T>, emptyValue: T): T => {
  const result = reader.read(field);
  if (result.status !== 'usable') return emptyValue;
  return result.value === undefined && emptyValue !== undefined ? emptyValue : result.value;
};

/** Genopbygger én tabelrække eksplicit, så schemaændringer giver typefejl i stedet for usikre casts. */
const rebuildRow = (reader: InputReader, rowId: string): StandardLoenTableRow => ({
  id: rowId,
  col0_maaned: readOrEmpty(reader, aarsloenTableCol0MaanedField.bind(rowId), aarsloenTableCol0MaanedField.emptyValue),
  col1_maaned: readOrEmpty(reader, aarsloenTableCol1MaanedField.bind(rowId), aarsloenTableCol1MaanedField.emptyValue),
  col0_uge: readOrEmpty(reader, aarsloenTableCol0UgeField.bind(rowId), aarsloenTableCol0UgeField.emptyValue),
  col1_uge: readOrEmpty(reader, aarsloenTableCol1UgeField.bind(rowId), aarsloenTableCol1UgeField.emptyValue),
  col0_dag: readOrEmpty(reader, aarsloenTableCol0DagField.bind(rowId), aarsloenTableCol0DagField.emptyValue),
  col1_dag: readOrEmpty(reader, aarsloenTableCol1DagField.bind(rowId), aarsloenTableCol1DagField.emptyValue),
  col2: readOrEmpty(reader, aarsloenTableCol2Field.bind(rowId), aarsloenTableCol2Field.emptyValue),
  col3: readOrEmpty(reader, aarsloenTableCol3Field.bind(rowId), aarsloenTableCol3Field.emptyValue),
  col4: readOrEmpty(reader, aarsloenTableCol4Field.bind(rowId), aarsloenTableCol4Field.emptyValue),
  col5: readOrEmpty(reader, aarsloenTableCol5Field.bind(rowId), aarsloenTableCol5Field.emptyValue),
  fpFvShSoBeloeb: readOrEmpty(
    reader,
    aarsloenTableFpFvShSoBeloebField.bind(rowId),
    aarsloenTableFpFvShSoBeloebField.emptyValue
  ),
  pensionBeloeb: readOrEmpty(
    reader,
    aarsloenTablePensionBeloebField.bind(rowId),
    aarsloenTablePensionBeloebField.emptyValue
  ),
});

/** Den kanoniske CollectionRef for løntabellen (top-level collection, ingen entity-parent). */
export const aarsloenTableDataCollectionRef: CollectionRef = tableDataCollection;

/**
 * Rekonstruerer løntabellens rækker (ikke-blokerende) direkte fra readeren, i den afsluttede rækkefølge. Bruges
 * af den greenfield StandardLoenTable til sortering, afledte kolonner og tomheds-vurdering — celleredigeringen
 * går derimod DIREKTE på cellens `FieldRef` via grid-adapteren (§1.10 pr-række-isolation).
 */
export const readAarsloenTableRows = (reader: InputReader): StandardLoenTableRow[] => {
  const rowIds = reader.listEntities(tableDataCollection).map((entity) => entity.entityId);
  return rowIds.map((rowId) => rebuildRow(reader, rowId));
};

/**
 * Rekonstruerer det komplette `AarsloenValues` fra readeren (ikke-blokerende). Erstatter `usePersistedForm`s
 * `values`. Skjulte (rød-fejl) felter/celler falder tilbage til deres tomværdi.
 */
export const readAarsloenValues = (reader: InputReader): AarsloenValues => {
  const tableData = readAarsloenTableRows(reader);

  return {
    feriePct: readOrEmpty(reader, scalarRefs.feriePct, aarsloenFeriePctField.emptyValue),
    fritvalgPct: readOrEmpty(reader, scalarRefs.fritvalgPct, aarsloenFritvalgPctField.emptyValue),
    shSoPct: readOrEmpty(reader, scalarRefs.shSoPct, aarsloenShSoPctField.emptyValue),
    storeBededagPct: readOrEmpty(reader, scalarRefs.storeBededagPct, aarsloenStoreBededagPctField.emptyValue),
    pensionPct: readOrEmpty(reader, scalarRefs.pensionPct, aarsloenPensionPctField.emptyValue),
    // Required-choice/toggle-felter: `readOrEmpty` giver descriptorens tomværdi ved null-sektion (fx 'maaned').
    loenperiode: readOrEmpty(reader, scalarRefs.loenperiode, aarsloenLoenperiodeField.emptyValue),
    tillaegAngivesSom: readOrEmpty(reader, scalarRefs.tillaegAngivesSom, aarsloenTillaegAngivesSomField.emptyValue),
    loenPaaHelligdage: readOrEmpty(reader, scalarRefs.loenPaaHelligdage, aarsloenLoenPaaHelligdageField.emptyValue),
    omregningTilFuldtAar: readOrEmpty(reader, scalarRefs.omregningTilFuldtAar, aarsloenOmregningTilFuldtAarField.emptyValue),
    fuldLoenUnderFerie: readOrEmpty(reader, scalarRefs.fuldLoenUnderFerie, aarsloenFuldLoenUnderFerieField.emptyValue),
    retTilSjetteFerieuge: readOrEmpty(reader, scalarRefs.retTilSjetteFerieuge, aarsloenRetTilSjetteFerieugeField.emptyValue),
    antalFeriedage: readOrEmpty(reader, scalarRefs.antalFeriedage, aarsloenAntalFeriedageField.emptyValue),
    tableData,
  };
};

const PERCENT_SCALAR_REFS: readonly FieldRef<number | undefined>[] = [
  scalarRefs.feriePct,
  scalarRefs.fritvalgPct,
  scalarRefs.shSoPct,
  scalarRefs.storeBededagPct,
  scalarRefs.pensionPct,
];

/**
 * Samler de RØDE feltfejl på de felter, der i legacy var fatale beregningsinput (satsprocenter + antalFeriedage).
 * En ikke-tom liste svarer til legacy's `harFatalBeregningsFejl` for et out-of-range input og undertrykker et
 * misvisende beregnet resultat. Betingelserne spejler `resolveAarsloenCanonicalRangeIssues` PRÆCIST (§1.9: et
 * skjult/irrelevant felt overblokerer ikke): satsprocenter tæller kun i procent-tilstand; antalFeriedage kun når
 * omregning er aktiv og der ikke er fuld løn under ferie. Tabelcelle-fejl indgår aldrig (legacy isolerer pr.
 * række, §1.10). `omregningAktiveret` er det samme effektive flag, som calc-hookene bruger.
 */
export const resolveAarsloenFieldErrorGate = (
  reader: InputReader,
  values: AarsloenValues,
  options: Readonly<{ omregningAktiveret: boolean }>
): readonly FieldIssue[] => {
  const issues: FieldIssue[] = [];

  if (values.tillaegAngivesSom === 'procent') {
    for (const ref of PERCENT_SCALAR_REFS) {
      const result = reader.read(ref);
      if (result.status === 'error') issues.push(result.issue);
    }
  }

  if (options.omregningAktiveret && !values.fuldLoenUnderFerie) {
    const result = reader.read(scalarRefs.antalFeriedage);
    if (result.status === 'error') issues.push(result.issue);
  }

  return Object.freeze(issues);
};

// ── Reader-afledt tabelvalidering (§2.5/§3.4) ──────────────────────────────────
// Legacy StandardLoenTable samlede tre celle-fejl-kilder i `cellErrorsByCellKey` og fodrede dem til den rene
// `getStandardLoenTableValidation`: (1) input-fejl via imperativt `onErrorChange`, (2) periode-rækkefølge-fejl,
// (3) eksterne fejl. Greenfield fjerner det imperative handle: både codec-fejl, datogrænser og periodeorden ER
// nu røde feltissues i readerens tokenbundne snapshot. Denne funktion er derfor den ENE kilde til tabellens summary — omregning-
// gaten og dokumentgaten afledes af den, så der ikke længere er et imperativt `getValidationSummary`/`getErrors`.

// Kolonneindeks pr. rækkecelle-descriptor (matcher legacy `resolveColIdxFromKey`): periodekolonner 0/1 er de
// synlige for den aktuelle lønperiode; beløb 2–5; tillægsbeløb 6/7 (kun redigerbare i Beløb-tilstand).
const recordCellError = <T>(
  reader: InputReader,
  rowId: string,
  colIndex: number,
  descriptor: FieldDescriptor<T>,
  target: Record<string, true>
): void => {
  if (reader.read(descriptor.bind(rowId)).status === 'error') target[`${rowId}:${colIndex}`] = true;
};

/**
 * Samler cellernes RØDE feltissues (rejected format/range) fra readeren til det numeriske `${rowId}:${colIndex}`-
 * cellenøgle-map, som `getStandardLoenTableValidation` forstår. Kun de kolonner, der er relevante for den aktuelle
 * lønperiode/tillægstilstand, læses (§1.9: en skjult/irrelevant celle overblokerer ikke).
 */
const collectReaderCellErrorsByCellKey = (
  reader: InputReader,
  rowIds: readonly string[],
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): Record<string, true> => {
  const cellErrors: Record<string, true> = {};
  for (const rowId of rowIds) {
    if (loenperiode === 'maaned') {
      recordCellError(reader, rowId, 0, aarsloenTableCol0MaanedField, cellErrors);
      recordCellError(reader, rowId, 1, aarsloenTableCol1MaanedField, cellErrors);
    } else if (loenperiode === 'uge') {
      recordCellError(reader, rowId, 0, aarsloenTableCol0UgeField, cellErrors);
      recordCellError(reader, rowId, 1, aarsloenTableCol1UgeField, cellErrors);
    } else {
      recordCellError(reader, rowId, 0, aarsloenTableCol0DagField, cellErrors);
      recordCellError(reader, rowId, 1, aarsloenTableCol1DagField, cellErrors);
    }
    recordCellError(reader, rowId, 2, aarsloenTableCol2Field, cellErrors);
    recordCellError(reader, rowId, 3, aarsloenTableCol3Field, cellErrors);
    recordCellError(reader, rowId, 4, aarsloenTableCol4Field, cellErrors);
    recordCellError(reader, rowId, 5, aarsloenTableCol5Field, cellErrors);
    if (tillaegAngivesSom === 'beloeb') {
      recordCellError(reader, rowId, 6, aarsloenTableFpFvShSoBeloebField, cellErrors);
      recordCellError(reader, rowId, 7, aarsloenTablePensionBeloebField, cellErrors);
    }
  }
  return cellErrors;
};

/**
 * Den ENE kilde til løntabellens valideringssummary i greenfield. Rekonstruerer rækkerne, samler celle-røde-fejl
 * fra readeren (inklusive descriptorernes periode-rækkefølge-fejl) og kører den rene tabelsummary. Resultatet
 * er 1:1 med legacy's summary (samme funktion, samme cellenøgle-kontrakt) — kun fejl-kilden er nu readeren.
 */
export const resolveStandardLoenTableValidation = (
  reader: InputReader,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): StandardLoenTableValidationResult => {
  const rowIds = reader.listEntities(tableDataCollection).map((entity) => entity.entityId);
  const rows = rowIds.map((rowId) => rebuildRow(reader, rowId));

  const cellErrorsByCellKey = collectReaderCellErrorsByCellKey(reader, rowIds, loenperiode, tillaegAngivesSom);
  return getStandardLoenTableValidation({ rows, loenperiode, cellErrorsByCellKey, tillaegAngivesSom });
};

/**
 * Årslønnens komplette, tokenbundne consumer-projektion. Den samler præcis de reader-afledninger, som side,
 * beregning og dokumentpreflight deler, så de ikke hver især kan rekonstruere eller gate input forskelligt.
 */
export type AarsloenReaderProjection = Readonly<{
  values: AarsloenValues;
  tableValidation: StandardLoenTableValidationResult;
  omregningGate: AarsloenOmregningGate;
  calculation: AarsloenBeregningState;
  fieldIssues: readonly FieldIssue[];
  documentStamdata: ProjectionResult<StamdataValues>;
  sourceToken: EvaluationSourceToken;
}>;

/** Bygger den kanoniske reader-projektion for Årsløn fra én afsluttet inputrevision. */
export const buildAarsloenReaderProjection = (reader: InputReader): AarsloenReaderProjection => {
  const values = readAarsloenValues(reader);
  const tableValidation = resolveStandardLoenTableValidation(reader, values.loenperiode, values.tillaegAngivesSom);
  const omregningGate = resolveAarsloenOmregningGate({
    requestedEnabled: values.omregningTilFuldtAar,
    tableData: values.tableData,
    loenperiode: values.loenperiode,
    validationSummary: tableValidation.summary,
  });
  const calculation = computeAarsloenBeregning({
    values,
    omregningAktiveret: omregningGate.effectiveEnabled,
  });
  const fieldIssues = resolveAarsloenFieldErrorGate(reader, values, {
    omregningAktiveret: omregningGate.effectiveEnabled,
  });

  return Object.freeze({
    values,
    tableValidation,
    omregningGate,
    calculation,
    fieldIssues,
    documentStamdata: projectStamdataForDocument(reader, 'document.aarsloen'),
    sourceToken: reader.sourceToken,
  });
};

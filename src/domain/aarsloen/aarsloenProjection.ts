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
import {
  buildStandardLoenPeriodOrderCellErrorMessages,
  getStandardLoenTableValidation,
  type StandardLoenTableValidationResult,
} from './standardLoenTableValidation';

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

// Rækkecelle-descriptors i feltnavn-orden, så en genopbygget række matcher `StandardLoenTableRow` 1:1.
const rowCellDescriptors: readonly FieldDescriptor<unknown>[] = [
  aarsloenTableCol0MaanedField,
  aarsloenTableCol1MaanedField,
  aarsloenTableCol0UgeField,
  aarsloenTableCol1UgeField,
  aarsloenTableCol0DagField,
  aarsloenTableCol1DagField,
  aarsloenTableCol2Field,
  aarsloenTableCol3Field,
  aarsloenTableCol4Field,
  aarsloenTableCol5Field,
  aarsloenTableFpFvShSoBeloebField,
  aarsloenTablePensionBeloebField,
] as unknown as readonly FieldDescriptor<unknown>[];

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

/** Genopbygger én tabelrække. Feltnavnet udledes af descriptorens `template.field` → præcis `StandardLoenTableRow`. */
const rebuildRow = (reader: InputReader, rowId: string): StandardLoenTableRow => {
  const row: Record<string, unknown> = { id: rowId };
  for (const descriptor of rowCellDescriptors) {
    row[descriptor.template.field] = readOrEmpty(reader, descriptor.bind(rowId), descriptor.emptyValue);
  }
  return row as StandardLoenTableRow;
};

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
// (3) eksterne fejl. Greenfield fjerner det imperative handle: input-fejlen ER nu et rødt feltissue i readerens
// tokenbundne snapshot (læs cellens ref → `status==='error'`), og periode-rækkefølgen er ren over de
// rekonstruerede rækker. Denne funktion er derfor den ENE kilde til tabellens valideringssummary — omregning-
// gaten og dokumentgaten afledes af den, så der ikke længere er et imperativt `getValidationSummary`/`getErrors`.

// Kolonneindeks pr. rækkecelle-descriptor (matcher legacy `resolveColIdxFromKey`): periodekolonner 0/1 er de
// synlige for den aktuelle lønperiode; beløb 2–5; tillægsbeløb 6/7 (kun redigerbare i Beløb-tilstand).
// Descriptor-typerne er invariante i deres værditype; til det generiske celle-error-scan behøver vi kun
// `bind(rowId)` + `read`-status, så vi caster hver descriptor til den uniforme `FieldDescriptor<unknown>`.
const asAny = (descriptor: object): FieldDescriptor<unknown> => descriptor as FieldDescriptor<unknown>;

const cellDescriptorsByColIndex: Readonly<Record<Loenperiode, readonly (readonly [number, FieldDescriptor<unknown>])[]>> = {
  maaned: [[0, asAny(aarsloenTableCol0MaanedField)], [1, asAny(aarsloenTableCol1MaanedField)]],
  uge: [[0, asAny(aarsloenTableCol0UgeField)], [1, asAny(aarsloenTableCol1UgeField)]],
  dag: [[0, asAny(aarsloenTableCol0DagField)], [1, asAny(aarsloenTableCol1DagField)]],
};

const baseAmountDescriptorsByColIndex: readonly (readonly [number, FieldDescriptor<unknown>])[] = [
  [2, asAny(aarsloenTableCol2Field)], [3, asAny(aarsloenTableCol3Field)],
  [4, asAny(aarsloenTableCol4Field)], [5, asAny(aarsloenTableCol5Field)],
];

const beloebAmountDescriptorsByColIndex: readonly (readonly [number, FieldDescriptor<unknown>])[] = [
  [6, asAny(aarsloenTableFpFvShSoBeloebField)], [7, asAny(aarsloenTablePensionBeloebField)],
];

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
  const relevant: (readonly [number, FieldDescriptor<unknown>])[] = [
    ...cellDescriptorsByColIndex[loenperiode],
    ...baseAmountDescriptorsByColIndex,
    ...(tillaegAngivesSom === 'beloeb' ? beloebAmountDescriptorsByColIndex : []),
  ];
  const cellErrors: Record<string, true> = {};
  for (const rowId of rowIds) {
    for (const [colIndex, descriptor] of relevant) {
      const result = reader.read(descriptor.bind(rowId));
      if (result.status === 'error') cellErrors[`${rowId}:${colIndex}`] = true;
    }
  }
  return cellErrors;
};

/**
 * Den ENE kilde til løntabellens valideringssummary i greenfield. Rekonstruerer rækkerne, samler celle-røde-fejl
 * fra readeren + periode-rækkefølge-fejl, og kører den uændrede rene `getStandardLoenTableValidation`. Resultatet
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
  // Periode-rækkefølge (dato/uge fra > til): ren over de rekonstruerede rækker; slås sammen med celle-røde-fejl.
  const periodOrderMessages = buildStandardLoenPeriodOrderCellErrorMessages(rows, loenperiode);
  for (const [cellKey, message] of Object.entries(periodOrderMessages)) {
    if (message.trim() === '') continue;
    cellErrorsByCellKey[cellKey] = true;
  }

  return getStandardLoenTableValidation({ rows, loenperiode, cellErrorsByCellKey, tillaegAngivesSom });
};

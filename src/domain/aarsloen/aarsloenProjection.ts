import type { AarsloenValues, Loenperiode, StandardLoenTableRow, TillaegAngivesSom } from '../../schemas/formSchemas';
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
  aarsloenTillaegAngivesSomField,
} from '../../inputCore/catalog/aarsloenDescriptors';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { InputReader } from '../../inputCore/inputReader';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { ProjectionResult } from '../../inputCore/projection';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import type { StamdataValues } from '../../schemas/formSchemas';
import { computeAarsloenBeregning, type AarsloenBeregningState } from './aarsloenBeregning';
import { resolveAarsloenOmregningGate, type AarsloenOmregningGate } from './aarsloenValidationPolicies';
import { type StandardLoenTableValidationResult } from './standardLoenTableValidation';
import {
  readStandardLoenTableRows,
  resolveStandardLoenTableValidationFromReader,
} from '../../components/tables/standardLoenTableFieldSet';
import { aarsloenStandardLoenFieldSet } from './aarsloenStandardLoenFieldSet';

// Årsløn-projektionen (§3.4/§5.4). En ALMINDELIG ren funktion over den
// offentlige `InputReader`, der genopbygger et komplet, schema-formet `AarsloenValues`-objekt fra readeren, så de
// EKSISTERENDE beregningsindgange (`computeAarsloenBeregning`, `useAarsloenDocumentGates`) kan køre UÆNDRET på det – nul
// talændring (§5.4 hårdt stop). Det er den sanktionerede fremflytning i §5.4: en migreret formular må ikke holde
// sin beregnings-/dokumentconsumer i live på rå sektioner, så consumeren fødes her gennem readeren i stedet.
//
// To komplementære reads (begge rene, ingen rå sektioner):
//  - `readAarsloenValues(reader)`: rekonstruerer `AarsloenValues` UDEN at blokere. En rød feltfejl skjules,
//    og cellen/feltet falder tilbage til sin tomværdi. Dette er kildeobjektet til visning og beregning.
//  - `resolveAarsloenFieldErrorGate(reader)`: samler RØDE feltfejl på de fatale beregningsinput
//    (satsprocenter + antalFeriedage). Den skjulte værdi må ikke give et misvisende beregnet resultat.
//    Tabelcellefejl isoleres pr. række (§1.10) og indgår derfor ikke i gaten.

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

/**
 * Ikke-blokerende read: canonical værdi eller feltets tomværdi. Falder tilbage til `emptyValue` både når værdien
 * er skjult bag en rød feltfejl OG når en null-sektion giver `undefined` for et felt, hvis tomværdi ikke er
 * `undefined` (fx en required-choice som loenperiode='maaned') – så defaulten svarer til descriptorens kontrakt.
 */
const readOrEmpty = <T>(reader: InputReader, field: FieldRef<T>, emptyValue: T): T => {
  const result = reader.read(field);
  if (result.status !== 'usable') return emptyValue;
  return result.value === undefined && emptyValue !== undefined ? emptyValue : result.value;
};

/**
 * Rekonstruerer løntabellens rækker (ikke-blokerende) i den afsluttede rækkefølge. Bruges af den
 * StandardLoenTable til sortering, afledte kolonner og tomheds-vurdering – celleredigeringen går derimod
 * DIREKTE på cellens `FieldRef` via grid-adapteren (§1.10 pr-række-isolation).
 *
 * Rekonstruktionen er den FÆLLES over feltsættet: modulet havde tidligere sin egen kopi, ordret
 * identisk med EO's bortset fra ejer-id'et i `bind`.
 */
export const readAarsloenTableRows = (reader: InputReader): StandardLoenTableRow[] =>
  readStandardLoenTableRows(aarsloenStandardLoenFieldSet, reader);

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
 * Samler de RØDE feltfejl på de fatale beregningsinput (satsprocenter + antalFeriedage) og
 * undertrykker et misvisende beregnet resultat. Betingelserne spejler
 * `resolveAarsloenCanonicalRangeIssues` PRÆCIST (§1.9: et
 * skjult/irrelevant felt overblokerer ikke): satsprocenter tæller kun i procent-tilstand; antalFeriedage kun når
 * omregning er aktiv og der ikke er fuld løn under ferie. Tabelcellefejl isoleres pr. række (§1.10).
 * `omregningAktiveret` er det samme effektive flag, som beregningshookene bruger.
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

/**
 * Den ENE kilde til løntabellens valideringssummary. Cellernes røde issues indsamles af den FÆLLES afledning
 * over feltsættet og køres gennem den rene tabelsummary – så tabellen, omregning-gaten og
 * dokumentgaten ikke kan se forskellige cellefejl.
 */
export const resolveStandardLoenTableValidation = (
  reader: InputReader,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): StandardLoenTableValidationResult =>
  resolveStandardLoenTableValidationFromReader(
    aarsloenStandardLoenFieldSet,
    reader,
    loenperiode,
    tillaegAngivesSom,
    'error'
  );

/**
 * Årslønnens komplette, tokenbundne consumer-projektion. Den samler præcis de reader-afledninger, som side,
 * beregning og dokumentpreflight deler, så de ikke hver især kan rekonstruere eller gate input forskelligt.
 */
export type AarsloenReaderProjection = Readonly<{
  values: AarsloenValues;
  tableValidation: StandardLoenTableValidationResult;
  omregningGate: AarsloenOmregningGate;
  /**
   * Beregningen – `null` når projektionen er blokeret (§3.9: motoren kaldes KUN i `ready`-grenen).
   *
   * En rød feltfejl skjuler værdien i readeren, og et resultat beregnet på den skjulte tomværdi ville være
   * misvisende. Det gælder BÅDE de beregningskritiske skalarer (satsprocent/antalFeriedage) OG en ugyldig
   * celle i en medregnet tabelrække: rækkeisolationen (§1.10) beskytter naborækkerne, men den gør ikke
   * summen autoritativ, når én af de summerede rækker har en ukendt værdi. Derfor findes der intet resultat,
   * mens gaten er rød – hverken på siden eller i dokumentpreflighten.
   */
  calculation: AarsloenBeregningState | null;
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
  // Feltgaten afgøres FØR motoren, så beregningen kun kaldes med input readeren vurderer brugbart (§3.9).
  const fieldIssues = resolveAarsloenFieldErrorGate(reader, values, {
    omregningAktiveret: omregningGate.effectiveEnabled,
  });
  // Aggregatet afhænger af ALLE medregnede rækker, også de celler §1.10 isolerer.
  //
  // Rækkeisolationen er stadig rigtig: en fejl i række 2 må ikke ødelægge række 2's naboer, og cellen skal
  // kunne rettes uden at resten forsvinder. Men isolationen gør ikke SUMMEN af række 1 og række 2
  // autoritativ, når række 2's værdi er ukendt. Readeren skjuler den røde celle bag sin tomværdi, så et
  // beregnet tal ville stille udelade den – en deltotal fremstillet som "Beregnet årsløn".
  //
  // Kun `invalid` gater, ikke `partial_period`. Sondringen er bevidst: en ufuldstændig periode er en helt
  // almindelig mellemtilstand, mens brugeren skriver rækken færdig, og at skjule totalen der ville være en
  // langt bredere adfærdsændring end den godkendte. En `invalid`-celle er derimod en aktiv rød fejl, hvis
  // værdi er ukendt. Dokumentgaten blokerer bredere (på hele `tableValidation.errors`) – det er den
  // eksisterende, uændrede regel for hvornår et DOKUMENT må produceres.
  const hasInvalidCell = tableValidation.errors.some(
    (error) => error.kind === 'cell' && error.issue === 'invalid'
  );
  const calculation = fieldIssues.length > 0 || hasInvalidCell
    ? null
    : computeAarsloenBeregning({ values, omregningAktiveret: omregningGate.effectiveEnabled });

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

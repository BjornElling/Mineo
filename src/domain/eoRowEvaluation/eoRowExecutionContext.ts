import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { EoRowPolicy } from '../../settings/sourceSettings';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { EoModel } from '../erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { EoInputIssue } from '../erstatningsopgoerelse/eoInputIssues';

/**
 * Type aliases for læsbarhed
 */
export type StamdataValues = PersistedSectionMap['stamdata'];
export type StamdataFieldName = Extract<keyof StamdataValues, string>;
export type StamdataFieldIssues = Partial<Record<StamdataFieldName, EoInputIssue>>;

export type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
export type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
export type ErstatningsopgoerelseFieldIssues = Partial<Record<ErstatningsopgoerelseFieldName, EoInputIssue>>;
export type LoenindkomstManuelReguleringInputErrors = Readonly<Record<string, true>>;

/**
 * Fælles execution-context for alle EO row-buildere
 *
 * Dette er ENESTE input til registry.
 * Let at udvide, nem at mocke i tests.
 */
export type EoRowEvaluationContext = {
  stamdataValues: StamdataValues;
  stamdataErrors: StamdataFieldIssues;
  eoValues: ErstatningsopgoerelseValues;
  eoErrors: ErstatningsopgoerelseFieldIssues;
  loenindkomstManuelReguleringInputErrors: LoenindkomstManuelReguleringInputErrors;
  /**
   * Row-buildernes faktiske regel-afhængighed: de TO toggles
   * `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` og
   * `allowReguleringMedUdloebMedMaaneder` (læst i `eoRowIndkomstRows.ts`). De afgør
   * validerings-severity for overenskomst-/reguleringsdækning og kan derfor flytte en EO-download
   * fra tilladt til blokeret.
   *
   * Typen er `EoRowPolicy` og ikke `AppSettings` eller `DocumentSettings`: rækkeevaluering er
   * BEREGNINGSLOGIK og skal hverken kende UI-indstillinger eller dokument-layoutlaget. (Feltet hed
   * tidligere `appSettings` med typen `DocumentSettings`, hvilket trak dokument-layoutlaget ind i
   * beregningen og samtidig gav builderne adgang til format- og brevhovedfelter, der er
   * fuldstændig irrelevante for, om en række er gyldig.)
   *
   * `isLoenindkomstAnsaettelsesforholdEffectivelyEmpty` bruger fortsat hele `AppSettings`, men den
   * er DEV-inspektionens prædikat, ikke gatens.
   */
  rowPolicy: EoRowPolicy;
  canonicalOutput?: EoCanonicalOutput;
  pdfModel?: EoModel;
};

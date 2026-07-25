import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { DocumentSettings } from '../../document/layout/documentBrevhoved';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { EoModel } from '../erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { EoFieldIssuesBySource } from '../erstatningsopgoerelse/eoInputIssues';

/**
 * Type aliases for læsbarhed
 */
export type StamdataValues = PersistedSectionMap['stamdata'];
export type StamdataFieldName = Extract<keyof StamdataValues, string>;
export type StamdataFieldErrorsBySource = Partial<Record<StamdataFieldName, EoFieldIssuesBySource>>;

export type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
export type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
export type ErstatningsopgoerelseFieldErrorsBySource = Partial<Record<ErstatningsopgoerelseFieldName, EoFieldIssuesBySource>>;
export type LoenindkomstManuelReguleringInputErrors = Readonly<Record<string, true>>;

/**
 * Fælles execution-context for alle EO row-buildere
 *
 * Dette er ENESTE input til registry.
 * Let at udvide, nem at mocke i tests.
 */
export type EoRowEvaluationContext = {
  stamdataValues: StamdataValues;
  stamdataErrors: StamdataFieldErrorsBySource;
  eoValues: ErstatningsopgoerelseValues;
  eoErrors: ErstatningsopgoerelseFieldErrorsBySource;
  loenindkomstManuelReguleringInputErrors: LoenindkomstManuelReguleringInputErrors;
  /**
   * Row-buildernes faktiske settings-afhængighed er de TO regel-toggles i `DocumentSettings`
   * (`allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` og
   * `allowReguleringMedUdloebMedMaaneder`, læst i `eoRowIndkomstRows.ts`). Kontrakten er derfor
   * bevidst smallere end `AppSettings`: den gør download-gatens settings-dependency synlig og
   * gør det umuligt for en builder at komme til at afhænge af en UI-indstilling, der ikke er med
   * i `evaluationSettingsFingerprint` — og som derfor ikke ville gøre et optaget
   * `EvaluationSourceToken` stale. `isLoenindkomstAnsaettelsesforholdEffectivelyEmpty` bruger
   * fortsat hele `AppSettings`, men den er DEV-inspektionens, ikke gatens.
   */
  appSettings: DocumentSettings;
  canonicalOutput?: EoCanonicalOutput;
  pdfModel?: EoModel;
};

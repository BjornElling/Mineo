import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { AppSettings } from '../../settings/appSettingsSchema';
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
  appSettings: AppSettings;
  canonicalOutput?: EoCanonicalOutput;
  pdfModel?: EoModel;
};

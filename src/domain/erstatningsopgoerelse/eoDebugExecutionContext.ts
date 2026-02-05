import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';

/**
 * Type aliases for læsbarhed
 */
export type StamdataValues = PersistedSectionMap['stamdata'];
export type StamdataFieldName = Extract<keyof StamdataValues, string>;
export type StamdataFieldErrorsBySource = Partial<Record<StamdataFieldName, FieldErrorBySource>>;

export type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
export type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
export type ErstatningsopgoerelseFieldErrorsBySource = Partial<Record<ErstatningsopgoerelseFieldName, FieldErrorBySource>>;
export type LoenindkomstManuelReguleringInputErrors = Readonly<Record<string, true>>;

/**
 * Fælles execution-context for alle EODebug builders
 *
 * Dette er ENESTE input til registry.
 * Let at udvide, nem at mocke i tests.
 */
export type EODebugExecutionContext = {
  stamdataValues: StamdataValues;
  stamdataErrors: StamdataFieldErrorsBySource;
  eoValues: ErstatningsopgoerelseValues;
  eoErrors: ErstatningsopgoerelseFieldErrorsBySource;
  loenindkomstManuelReguleringInputErrors: LoenindkomstManuelReguleringInputErrors;
};

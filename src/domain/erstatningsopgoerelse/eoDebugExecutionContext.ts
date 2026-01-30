import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';

/**
 * Type aliases for læsbarhed
 */
type StamdataValues = PersistedSectionMap['stamdata'];
type StamdataFieldName = Extract<keyof StamdataValues, string>;
type StamdataFieldErrorsBySource = Partial<Record<StamdataFieldName, FieldErrorBySource>>;

type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
type ErstatningsopgoerelseFieldErrorsBySource = Partial<Record<ErstatningsopgoerelseFieldName, FieldErrorBySource>>;

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
};

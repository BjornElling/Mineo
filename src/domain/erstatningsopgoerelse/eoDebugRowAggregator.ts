/**
 * Data-aggregering for Beregning-fanen
 *
 * Samler alle DebugRowModel fra centraliseret builder-registry og tilføjer navigation-metadata.
 * Returnerer grupperet efter status (error/warning) til visning i Beregning-fanen.
 *
 * REFACTORET: Bruger nu centraliseret builder-registry som single source of truth.
 * Ingen risiko for divergens mellem EODebug og EOberegningTab.
 */

import type { DebugRowModel } from '../debug/eoDebugTypes';
import type { NavigationTarget } from './eoDebugNavigationMap';
import type {
  EODebugExecutionContext,
  StamdataValues,
  StamdataFieldErrorsBySource,
  ErstatningsopgoerelseValues,
  ErstatningsopgoerelseFieldErrorsBySource,
} from './eoDebugExecutionContext';
import { getNavigationTargetFromRowId } from './eoDebugNavigationMap';
import { executeAllEODebugBuilders } from './eoDebugBuilderRegistry';

/**
 * DebugRowModel udvidet med navigation-metadata
 *
 * Navigation beregnes ÉN gang i domain-laget, ikke i UI-render loop
 */
export type DebugRowWithNavigation = DebugRowModel & {
  navigation: NavigationTarget;
};

/**
 * Grupperet resultat af fejl og warnings
 */
export type BeregningErrorSummary = {
  errors: ReadonlyArray<DebugRowWithNavigation>;
  warnings: ReadonlyArray<DebugRowWithNavigation>;
  allRows: ReadonlyArray<DebugRowWithNavigation>;
};

/**
 * Tilføjer navigation-metadata til DebugRowModel
 */
const addNavigationMetadata = (row: DebugRowModel): DebugRowWithNavigation => ({
  ...row,
  navigation: getNavigationTargetFromRowId(row.id),
});

/**
 * Samler alle debug-rows fra registry og tilføjer navigation
 *
 * FORENKLET: Bruger nu centraliseret builder-registry.
 * Ingen risiko for divergens mellem EODebug og EOberegningTab.
 *
 * @param stamdataValues - Stamdata values fra FormPersistence
 * @param stamdataErrors - Stamdata field errors by source
 * @param erstatningsopgoerelseValues - Erstatningsopgørelse values fra FormPersistence
 * @param erstatningsopgoerelseErrors - Erstatningsopgørelse field errors by source
 * @returns Grupperet efter status (errors, warnings)
 */
export const collectAllDebugRows = (
  stamdataValues: StamdataValues,
  stamdataErrors: StamdataFieldErrorsBySource,
  erstatningsopgoerelseValues: ErstatningsopgoerelseValues,
  erstatningsopgoerelseErrors: ErstatningsopgoerelseFieldErrorsBySource
): BeregningErrorSummary => {
  // Opret execution context
  const ctx: EODebugExecutionContext = {
    stamdataValues,
    stamdataErrors,
    eoValues: erstatningsopgoerelseValues,
    eoErrors: erstatningsopgoerelseErrors,
  };

  // Udfør alle builders fra registry
  const allRows: DebugRowModel[] = executeAllEODebugBuilders(ctx);

  // Tilføj navigation-metadata til alle rows
  const rowsWithNavigation = allRows.map(addNavigationMetadata);

  // Filtrer og gruppér efter status
  const errors = rowsWithNavigation.filter((r) => r.status === 'error');
  const warnings = rowsWithNavigation.filter((r) => r.status === 'warning');

  return { errors, warnings, allRows: rowsWithNavigation };
};

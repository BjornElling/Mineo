/**
 * Data-aggregering for Beregning-fanen
 *
 * Samler alle DebugRowModel fra centraliseret builder-registry og tilføjer navigation-metadata.
 * Returnerer grupperet efter status (error/warning) til visning i Beregning-fanen.
 *
 * Bruger samme builder-registry som EO-debug siden for rå debug-rækker.
 * EO-debug siden og Beregning-fanen har stadig forskellig post-processing oven på disse rækker.
 */

import type { DebugRowModel } from './eoDebugTypes';
import type { NavigationTarget } from './eoDebugNavigationMap';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../settings/appSettingsSchema';
import type {
  EODebugExecutionContext,
  StamdataValues,
  StamdataFieldErrorsBySource,
  ErstatningsopgoerelseValues,
  ErstatningsopgoerelseFieldErrorsBySource,
} from './eoDebugExecutionContext';
import { getNavigationTargetFromRowId } from './eoDebugNavigationMap';
import { executeAllEODebugBuilders } from './eoDebugBuilderRegistry';
import { resolveDebugRowPresentation } from './eoDebugRowPresentation';
import { toDebugStatusRank } from './eoDebugSeverity';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';

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
  relevantRows: ReadonlyArray<DebugRowWithNavigation>;
};

type DebugStatus = DebugRowModel['status'];

const resolveDependencyIds = (
  row: DebugRowWithNavigation,
  allIdsSorted: ReadonlyArray<string>,
  rowIdSet: ReadonlySet<string>
): ReadonlyArray<string> => {
  const specs = row.dependsOn ?? [];
  const resolved = new Set<string>();
  for (const spec of specs) {
    if (spec.kind === 'id') {
      if (spec.id !== row.id && rowIdSet.has(spec.id)) {
        resolved.add(spec.id);
      }
    } else {
      for (const candidateId of allIdsSorted) {
        if (candidateId === row.id) continue;
        if (candidateId.startsWith(spec.prefix)) {
          resolved.add(candidateId);
        }
      }
    }
  }
  return Array.from(resolved);
};

const buildDependencyGraph = (
  rows: ReadonlyArray<DebugRowWithNavigation>
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const allIds = rows.map((row) => row.id);
  const allIdsSorted = Array.from(new Set(allIds)).sort((a, b) => a.localeCompare(b));
  const rowIdSet = new Set(allIdsSorted);
  const depsById = new Map<string, ReadonlyArray<string>>();
  rows.forEach((row) => {
    depsById.set(row.id, resolveDependencyIds(row, allIdsSorted, rowIdSet));
  });
  return depsById;
};

const detectDependencyCycles = (
  ids: ReadonlyArray<string>,
  depsById: ReadonlyMap<string, ReadonlyArray<string>>
): ReadonlySet<string> => {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const inCycle = new Set<string>();

  const visit = (id: string): void => {
    const currentState = state.get(id) ?? 0;
    if (currentState === 1) {
      const index = stack.indexOf(id);
      if (index >= 0) {
        for (let i = index; i < stack.length; i += 1) {
          inCycle.add(stack[i]);
        }
      }
      inCycle.add(id);
      return;
    }
    if (currentState === 2) return;

    state.set(id, 1);
    stack.push(id);

    const parents = depsById.get(id) ?? [];
    parents.forEach(visit);

    stack.pop();
    state.set(id, 2);
  };

  ids.forEach(visit);
  return inCycle;
};

const buildMaxAncestorSeverityMap = (
  ids: ReadonlyArray<string>,
  depsById: ReadonlyMap<string, ReadonlyArray<string>>,
  statusById: ReadonlyMap<string, DebugStatus>,
  inCycle: ReadonlySet<string>
): ReadonlyMap<string, number> => {
  const memo = new Map<string, number>();

  const compute = (id: string): number => {
    if (inCycle.has(id)) return 0;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;

    let maxSeverity = 0;
    const parents = depsById.get(id) ?? [];
    for (const parentId of parents) {
      if (inCycle.has(parentId)) continue;
      const parentSeverity = toDebugStatusRank(statusById.get(parentId));
      const ancestorSeverity = compute(parentId);
      if (parentSeverity > maxSeverity) maxSeverity = parentSeverity;
      if (ancestorSeverity > maxSeverity) maxSeverity = ancestorSeverity;
    }

    memo.set(id, maxSeverity);
    return maxSeverity;
  };

  ids.forEach((id) => {
    if (!memo.has(id)) compute(id);
  });

  return memo;
};

const shouldSuppressRow = (
  row: DebugRowWithNavigation,
  maxAncestorSeverityById: ReadonlyMap<string, number>
): boolean => {
  // Policy (explicit): suppress child rows when an ancestor has equal or higher severity.
  // This keeps Beregning-fanen focused on root-cause rows and avoids duplicate fault reporting.
  const rowSeverity = toDebugStatusRank(row.status);
  if (rowSeverity === 0) return false;
  const maxAncestorSeverity = maxAncestorSeverityById.get(row.id) ?? 0;
  return maxAncestorSeverity >= rowSeverity;
};

const findDuplicateIds = (rows: ReadonlyArray<DebugRowWithNavigation>): ReadonlyArray<string> => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  });
  const duplicates: string[] = [];
  counts.forEach((count, id) => {
    if (count > 1) duplicates.push(id);
  });
  return duplicates.sort((a, b) => a.localeCompare(b));
};

/**
 * Tilføjer navigation-metadata til DebugRowModel
 */
const addNavigationMetadata = (row: DebugRowModel): DebugRowWithNavigation => ({
  ...row,
  ...resolveDebugRowPresentation(row),
  navigation: getNavigationTargetFromRowId(row.id),
});

const isRowRelevantForEoValues = (
  row: DebugRowWithNavigation,
  values: ErstatningsopgoerelseValues
): boolean => {
  // Domain relevance rules:
  // A row is irrelevant when the corresponding feature is explicitly disabled.
  if (values.beregnesSvieSmerteGodtgoerelse === 'Nej' && row.id.startsWith('sviesmerte.')) {
    return false;
  }
  if (values.beregnesTabtArbejdsfortjeneste === 'Nej') {
    // NOTE:
    // loenindkomst.* filtreres sammen med TAF, da lønindkomst
    // udelukkende anvendes til Tabt Arbejdsfortjeneste.
    // Hvis lønindkomst senere bliver et selvstændigt domæne,
    // skal denne filtrering og EODebug UI genovervejes.
    if (row.id.startsWith('taf.')) return false;
    if (row.id.startsWith('sfgg.')) return false;
    // Lønindkomst-sektionen er kun relevant når TAF beregnes.
    if (row.id.startsWith('loenindkomst.')) return false;
  }
  if (values.midlertidigtEetAfgorelse === 'Nej') {
    // NOTE:
    // EET-relaterede debug-rows filtreres, når der ikke foreligger
    // midlertidig/endelig erhvervsevnetabsafgørelse.
    // EET-debug må ikke producere fejl eller warnings,
    // når afgørelsen eksplicit er "Nej".
    if (
      row.id === 'aes.midlertidigEETAfgoerelseDato' ||
      row.id === 'aes.midlertidigEETVirkningsdato' ||
      row.id === 'aes.beregnetMidlertidigEETStartdato'
    ) {
      return false;
    }
  }
  if (values.endeligtEetAfgorelse === 'Nej') {
    if (
      row.id === 'aes.endeligEETAfgoerelseDato' ||
      row.id === 'aes.endeligEETVirkningsdato' ||
      row.id === 'aes.beregnetEndeligEETStartdato'
    ) {
      return false;
    }
  }
  return true;
};



/**
 * Samler alle debug-rows fra registry og tilføjer navigation
 *
 * Bruger samme builder-registry som EO-debug siden for rå debug-rækker.
 * EO-debug siden og Beregning-fanen har stadig forskellig post-processing.
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
  erstatningsopgoerelseErrors: ErstatningsopgoerelseFieldErrorsBySource,
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>> = {},
  appSettings: AppSettings = DEFAULT_APP_SETTINGS,
  canonicalOutputOverride?: EoCanonicalOutput
): BeregningErrorSummary => {
  // Opret execution context
  const ctx: EODebugExecutionContext = {
    stamdataValues,
    stamdataErrors,
    eoValues: erstatningsopgoerelseValues,
    eoErrors: erstatningsopgoerelseErrors,
    loenindkomstManuelReguleringInputErrors,
    appSettings,
    canonicalOutput: canonicalOutputOverride,
  };

  // Udfør alle builders fra registry
  const allRows: DebugRowModel[] = executeAllEODebugBuilders(ctx);

  // Tilføj navigation-metadata til alle rows
  const rowsWithNavigation = allRows.map(addNavigationMetadata);
  // Duplicate-id check MUST run before relevance filtering.
  const duplicateIds = findDuplicateIds(rowsWithNavigation);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplikat-id fundet i debug-rows: ${duplicateIds.join(', ')}. ` +
        'Debug-ids skal være entydige for at sikre korrekt suppression.'
    );
  }
  const relevantRows = rowsWithNavigation.filter((row) =>
    isRowRelevantForEoValues(row, erstatningsopgoerelseValues)
  );
  const statusById = new Map(relevantRows.map((row) => [row.id, row.status]));
  const ids = relevantRows.map((row) => row.id);
  const depsById = buildDependencyGraph(relevantRows);
  const inCycle = detectDependencyCycles(ids, depsById);
  if (inCycle.size > 0) {
    const idsPreview = Array.from(inCycle)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 10);
    const suffix = inCycle.size > idsPreview.length ? ' …' : '';
    const message = `Debug dependency cycle detected (no suppression applied for cycle nodes): ${idsPreview.join(
      ', '
    )}${suffix}`;
    // Fail-closed in all environments: cycles make suppression non-deterministic.
    throw new Error(message);
  }
  const maxAncestorSeverityById = buildMaxAncestorSeverityMap(ids, depsById, statusById, inCycle);

  // Filtrer og gruppér efter status
  const errors = relevantRows.filter(
    (r) => r.status === 'error' && !shouldSuppressRow(r, maxAncestorSeverityById)
  );
  const warnings = relevantRows.filter(
    (r) => r.status === 'warning' && !shouldSuppressRow(r, maxAncestorSeverityById)
  );

  return { errors, warnings, allRows: rowsWithNavigation, relevantRows };
};

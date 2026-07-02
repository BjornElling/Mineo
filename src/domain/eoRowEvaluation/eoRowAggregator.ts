/**
 * `collectAllEoRows` — den AUTORITATIVE EO-række-evaluerings-aggregator (jf. B9).
 *
 * Samler alle status-rækker fra builder-registret, tilføjer navigation-metadata, anvender
 * relevans-filtrering (`isRowRelevantForEoValues`) + dependency-suppression, og grupperer efter
 * status (error/warning). Dens `error`-rækker DRIVER produktions-PDF-download-gaten i
 * `useEoBeregningViewModel` — dette er derfor trust-kritisk produktions-validering, ikke "bare gennemsyn/kontrol".
 *
 * Derfor bor modulet i `src/domain/eoRowEvaluation/` (autoritativt, gennemsyns-/kontrol-frit), ikke i
 * `src/domain/eoInspektion/`. DEV-gennemsyns-/kontrolsiden er nedstrøms: den konsumerer de samme row-buildere til visning,
 * men kan aldrig flytte gaten via display-formattering (jf. `inspektionLayerIsolation.test.ts`).
 */

import type { EoRowModel } from './eoRowTypes';
import type { NavigationTarget } from './eoRowNavigationMap';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../settings/appSettingsSchema';
import type {
  EoRowEvaluationContext,
  StamdataValues,
  StamdataFieldErrorsBySource,
  ErstatningsopgoerelseValues,
  ErstatningsopgoerelseFieldErrorsBySource,
} from './eoRowExecutionContext';
import { getNavigationTargetFromRowId } from './eoRowNavigationMap';
import { executeAllEoRowBuilders } from './eoRowBuilderRegistry';
import { resolveEoRowPresentation } from './eoRowPresentation';
import { resolveCatalogSuppressionParents } from './eoRowIssueCatalog';
import { toEoRowStatusRank } from './eoRowSeverity';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { EoModel } from '../erstatningsopgoerelse/snapshot/eoPresentationModel';

/**
 * EoRowModel udvidet med navigation-metadata
 *
 * Navigation beregnes ÉN gang i domain-laget, ikke i UI-render loop
 */
export type EoRowWithNavigation = EoRowModel & {
  navigation: NavigationTarget;
};

/**
 * Grupperet resultat af fejl og warnings
 */
export type BeregningErrorSummary = {
  errors: ReadonlyArray<EoRowWithNavigation>;
  warnings: ReadonlyArray<EoRowWithNavigation>;
  allRows: ReadonlyArray<EoRowWithNavigation>;
  relevantRows: ReadonlyArray<EoRowWithNavigation>;
};

type EoRowStatus = EoRowModel['status'];

const resolveDependencyIds = (
  row: EoRowWithNavigation,
  allIdsSorted: ReadonlyArray<string>,
  rowIdSet: ReadonlySet<string>,
  rows: ReadonlyArray<EoRowWithNavigation>
): ReadonlyArray<string> => {
  const specs = [
    ...(row.dependsOn ?? []),
    ...resolveCatalogSuppressionParents(row, rows),
  ];
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
  rows: ReadonlyArray<EoRowWithNavigation>
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const allIds = rows.map((row) => row.id);
  const allIdsSorted = Array.from(new Set(allIds)).sort((a, b) => a.localeCompare(b));
  const rowIdSet = new Set(allIdsSorted);
  const depsById = new Map<string, ReadonlyArray<string>>();
  rows.forEach((row) => {
    depsById.set(row.id, resolveDependencyIds(row, allIdsSorted, rowIdSet, rows));
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
  statusById: ReadonlyMap<string, EoRowStatus>,
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
      const parentSeverity = toEoRowStatusRank(statusById.get(parentId));
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
  row: EoRowWithNavigation,
  maxAncestorSeverityById: ReadonlyMap<string, number>
): boolean => {
  // Policy (eksplicit): undertryk child-rækker, når en ancestor har samme eller højere severity.
  // Dette holder Beregning-fanen fokuseret på root-cause-rækker og undgår dobbelt fejlrapportering.
  const rowSeverity = toEoRowStatusRank(row.status);
  if (rowSeverity === 0) return false;
  const maxAncestorSeverity = maxAncestorSeverityById.get(row.id) ?? 0;
  return maxAncestorSeverity >= rowSeverity;
};

const findDuplicateIds = (rows: ReadonlyArray<EoRowWithNavigation>): ReadonlyArray<string> => {
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
 * Tilføjer navigation-metadata til EoRowModel
 */
const addNavigationMetadata = (row: EoRowModel): EoRowWithNavigation => ({
  ...row,
  ...resolveEoRowPresentation(row),
  navigation: getNavigationTargetFromRowId(row.id),
});

const isRowRelevantForEoValues = (
  row: EoRowWithNavigation,
  values: ErstatningsopgoerelseValues
): boolean => {
  // Domæne-relevansregler:
  // En række er irrelevant, når den tilsvarende funktion ikke beregnes ('Nej' eller 'Skjul').
  if (values.kravPaaSvieSmerteGodtgoerelse !== 'Ja' && row.id.startsWith('sviesmerte.')) {
    return false;
  }
  if (values.kravPaaOevrigeErstatningskrav !== 'Ja' && row.id.startsWith('oevrigekrav.')) {
    return false;
  }
  // Over-block-fix (B9 §2D, brugergodkendt 2026-06-24): de to krævede oversigtsfelter må kun
  // blokere, når den tilhørende beregning faktisk kræves. 'Arbejdssituation' (tafArbejdsstatus)
  // indgår udelukkende i TAF-fremstillingen; 'Helbredsforhold' (svieSmerteHelbredsstatus) kun i
  // svie/smerte. Tidligere blokerede de PDF-download uanset relevans, fordi deres id'er ikke matcher
  // de prefiks-baserede regler nedenfor — fx blokerede tom Arbejdssituation selv med TAF='Nej'.
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja' && row.id === 'erstatningsopgoerelse.arbejdsstatus') {
    return false;
  }
  if (values.kravPaaSvieSmerteGodtgoerelse !== 'Ja' && row.id === 'erstatningsopgoerelse.helbredsstatus') {
    return false;
  }
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') {
    // NOTE:
    // loenindkomst.* filtreres sammen med TAF, da lønindkomst
    // udelukkende anvendes til Tabt Arbejdsfortjeneste.
    // Hvis lønindkomst senere bliver et selvstændigt domæne,
    // skal denne filtrering og EOInspektion UI genovervejes.
    if (row.id.startsWith('taf.')) return false;
    if (row.id.startsWith('sfgg.')) return false;
    // Lønindkomst-sektionen er kun relevant når TAF beregnes.
    if (row.id.startsWith('loenindkomst.')) return false;
  }
  if (values.midlertidigtEETAfgorelse === 'Nej') {
    // NOTE:
    // EET-relaterede EO-rækker filtreres, når der ikke foreligger
    // midlertidig/endelig erhvervsevnetabsafgørelse.
    // EET-gennemsyn/kontrol må ikke producere fejl eller warnings,
    // når afgørelsen eksplicit er "Nej".
    if (
      row.id === 'aes.midlertidigEETAfgoerelseDato' ||
      row.id === 'aes.midlertidigEETVirkningsdato' ||
      row.id === 'aes.beregnetMidlertidigEETStartdato'
    ) {
      return false;
    }
  }
  if (values.endeligtEETAfgorelse === 'Nej') {
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
 * Samler alle EO-rækker fra registry og tilføjer navigation
 *
 * Bruger samme builder-registry som EO-gennemsyn-siden for rå EO-rækker.
 * EO-gennemsyn-siden og Beregning-fanen har stadig forskellig post-processing.
 *
 * @param stamdataValues - Stamdata-værdier fra FormPersistence
 * @param stamdataErrors - Stamdata field-fejl pr. kilde
 * @param erstatningsopgoerelseValues - Erstatningsopgørelse-værdier fra FormPersistence
 * @param erstatningsopgoerelseErrors - Erstatningsopgørelse field-fejl pr. kilde
 * @param canonicalOutputOverride - Autoritative totaler fra snapshot (canonical)
 * @param pdfModelOverride - Præsentationsmodellen fra snapshot. SKAL gives, så de SFGG-rækker
 *   der afhænger af det beregnede resultat (fx `sfgg.dagssats.*`/`sfgg.referencesats.*`-fejl) også
 *   evalueres af download-gaten. Uden den var gaten blind for de samme fejl, DEV-gennemsyns-/kontrolfanen viste
 *   som blokerende — en fail-open-asymmetri (jf. eoSnapshotToInspektionView, der altid sætter pdfModel).
 * @returns Grupperet efter status (errors, warnings)
 */
export const collectAllEoRows = (
  stamdataValues: StamdataValues,
  stamdataErrors: StamdataFieldErrorsBySource,
  erstatningsopgoerelseValues: ErstatningsopgoerelseValues,
  erstatningsopgoerelseErrors: ErstatningsopgoerelseFieldErrorsBySource,
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>> = {},
  appSettings: AppSettings = DEFAULT_APP_SETTINGS,
  canonicalOutputOverride?: EoCanonicalOutput,
  pdfModelOverride?: EoModel
): BeregningErrorSummary => {
  // Opret execution context
  const ctx: EoRowEvaluationContext = {
    stamdataValues,
    stamdataErrors,
    eoValues: erstatningsopgoerelseValues,
    eoErrors: erstatningsopgoerelseErrors,
    loenindkomstManuelReguleringInputErrors,
    appSettings,
    canonicalOutput: canonicalOutputOverride,
    pdfModel: pdfModelOverride,
  };

  // Udfør alle builders fra registry
  const allRows: EoRowModel[] = executeAllEoRowBuilders(ctx);

  // Tilføj navigation-metadata til alle rows
  const rowsWithNavigation = allRows.map(addNavigationMetadata);
  // Duplicate-id-check SKAL køre før relevansfiltrering.
  const duplicateIds = findDuplicateIds(rowsWithNavigation);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplikat-id fundet i EO-rækker: ${duplicateIds.join(', ')}. ` +
        'EO-række-id’er skal være entydige for at sikre korrekt suppression.'
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
    const message = `EO row dependency cycle detected (no suppression applied for cycle nodes): ${idsPreview.join(
      ', '
    )}${suffix}`;
    // Fail-closed i alle miljøer: cyklusser gør suppression ikke-deterministisk.
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

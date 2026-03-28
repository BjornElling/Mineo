import type { AppSettings } from '../../settings/appSettingsSchema';
import {
  EO_DEBUG_BUILDERS,
  executeEODebugBuilderEntriesBySection,
} from '../debug/eoDebugBuilderRegistry';
import type { EODebugExecutionContext } from '../debug/eoDebugExecutionContext';
import { buildRegulationTimeline } from '../debug/eoDebugRegulationCore';
import type { RegulationDebugSection } from '../debug/eoDebugRegulationViewModel';
import { buildRegulationDebugSections } from '../debug/eoDebugRegulationViewModel';
import type { SectionId } from '../debug/eoDebugNavigationMap';
import type { DebugRowModel } from '../debug/eoDebugTypes';
import type { EoCanonicalOutput } from './eoCanonicalOutput';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';

type EoDebugViewBlocked = Readonly<{
  kind: 'blocked';
  severity: 'info' | 'error';
  title: string;
  message: string;
}>;

type EoDebugViewReady = Readonly<{
  kind: 'ready';
  canonicalOutput: EoCanonicalOutput | undefined;
  debugSnapshot: NonNullable<EoSnapshot['debugSnapshot']>;
  stamdataValues: NonNullable<EoSnapshot['input']['stamdata']>;
  erstatningsopgoerelseValues: NonNullable<EoSnapshot['input']['erstatningsopgoerelse']>;
  rowsBySection: ReadonlyMap<SectionId, readonly DebugRowModel[]>;
  regulationSections: readonly RegulationDebugSection[];
}>;

export type EoDebugView = EoDebugViewBlocked | EoDebugViewReady;
export type { EoDebugViewReady };

export const eoSnapshotToDebugView = (args: Readonly<{
  snapshot?: EoSnapshot | null;
  appSettings: AppSettings;
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>>;
}>): EoDebugView => {
  const snapshot = args.snapshot ?? null;
  if (!snapshot) {
    return {
      kind: 'blocked',
      severity: 'info',
      title: 'EO debug kræver et friskt snapshot',
      message: 'Åbn debug-fanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.',
    };
  }

  // fail_closed routes altid til fejlvisning — uanset om debugSnapshot er tilstede.
  if (snapshot.status === 'fail_closed') {
    return {
      kind: 'blocked',
      severity: 'error',
      title: 'EO debug er blokeret',
      message: snapshot.invariants[0]?.message ?? 'Der opstod en intern fejl i EO-snapshot.',
    };
  }

  const debugSnapshot = snapshot.debugSnapshot;
  if (debugSnapshot) {
    const stamdataValues = debugSnapshot.stamdataValues;
    const erstatningsopgoerelseValues = debugSnapshot.eoValues;
    const canonicalOutput = hasEoSnapshotData(snapshot) ? snapshot.data.canonicalOutput : undefined;

    const ctx: EODebugExecutionContext = {
      stamdataValues,
      stamdataErrors: debugSnapshot.fieldErrors.stamdata,
      eoValues: erstatningsopgoerelseValues,
      eoErrors: debugSnapshot.fieldErrors.erstatningsopgoerelse,
      loenindkomstManuelReguleringInputErrors: args.loenindkomstManuelReguleringInputErrors,
      appSettings: args.appSettings,
      canonicalOutput,
    };

    return {
      kind: 'ready',
      canonicalOutput,
      debugSnapshot,
      stamdataValues,
      erstatningsopgoerelseValues,
      rowsBySection: executeEODebugBuilderEntriesBySection(EO_DEBUG_BUILDERS, ctx),
      regulationSections: buildRegulationDebugSections({
        timeline: buildRegulationTimeline({
          debugDays: debugSnapshot.debugDays,
          eoValues: erstatningsopgoerelseValues,
          stamdataValues,
        }),
        canonicalOutput,
        eoValues: erstatningsopgoerelseValues,
        stamdataValues,
      }),
    };
  }

  // Alle ikke-fail_closed snapshots har gyldigt input, men manglende debugSnapshot
  // skyldes at valideringen blokerede engine-kørslen. Vis den relevante fejlbesked.
  return {
    kind: 'blocked',
    severity: 'info',
    title: 'EO debug kræver et gyldigt debug-snapshot',
    message: 'Ret valideringsfejlene i sagen og åbn debug-fanen igen for at bygge debug på korrekt committede data.',
  };
};

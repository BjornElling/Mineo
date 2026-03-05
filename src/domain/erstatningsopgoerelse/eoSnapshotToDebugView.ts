import type { AppSettings } from '../../settings/appSettingsSchema';
import {
  EO_DEBUG_BUILDERS,
} from '../debug/eoDebugBuilderRegistry';
import type { EODebugExecutionContext } from '../debug/eoDebugExecutionContext';
import { buildLoenTimeline } from '../debug/eoDebugLoenCoreModel';
import type { LoenDebugSection } from '../debug/eoDebugLoenViewModel';
import { buildLoenDebugSections } from '../debug/eoDebugLoenViewModel';
import { buildRegulationTimeline } from '../debug/eoDebugRegulationCore';
import type { RegulationDebugSection } from '../debug/eoDebugRegulationViewModel';
import { buildRegulationDebugSections } from '../debug/eoDebugRegulationViewModel';
import type { SectionId } from '../debug/eoDebugNavigationMap';
import type { DebugDay, DebugRowModel } from '../debug/eoDebugTypes';
import type { EoCanonicalOutput } from './eoCanonicalOutput';
import type { EoSnapshot } from './eoSnapshot';

type EoDebugViewBlocked = Readonly<{
  kind: 'blocked';
  severity: 'info' | 'error';
  title: string;
  message: string;
}>;

type EoDebugViewReady = Readonly<{
  kind: 'ready';
  canonicalOutput: EoCanonicalOutput | undefined;
  debugSnapshot: NonNullable<NonNullable<EoSnapshot['data']>['debugSnapshot']>;
  stamdataValues: NonNullable<EoSnapshot['input']['stamdata']>;
  erstatningsopgoerelseValues: NonNullable<EoSnapshot['input']['erstatningsopgoerelse']>;
  rowsBySection: ReadonlyMap<SectionId, readonly DebugRowModel[]>;
  loenSections: readonly LoenDebugSection[];
  regulationSections: readonly RegulationDebugSection[];
}>;

export type EoDebugView = EoDebugViewBlocked | EoDebugViewReady;

const buildRowsBySection = (ctx: EODebugExecutionContext): ReadonlyMap<SectionId, readonly DebugRowModel[]> => {
  const map = new Map<SectionId, DebugRowModel[]>();

  for (const entry of EO_DEBUG_BUILDERS) {
    try {
      map.set(entry.section, entry.run(ctx));
    } catch (error) {
      const message = error instanceof Error && error.message.trim() !== '' ? error.message : 'Ukendt fejl';
      map.set(entry.section, [{
        id: `debug.builder.${entry.section}.exception`,
        label: `Fejl i debug-builder (${entry.section})`,
        displayValue: `Fejl (Builder-fejl: ${message})`,
        status: 'error',
      }]);
    }
  }

  return map;
};

const buildDebugDaysFromSnapshot = (
  snapshot: NonNullable<NonNullable<EoSnapshot['data']>['debugSnapshot']>
): readonly DebugDay[] => {
  const { tableData } = snapshot.model;
  const dates = tableData.dates;

  return dates.map((iso, rowIndex) => {
    return {
      iso,
      weekday: tableData.weekdayIndexByRow[rowIndex] ?? 1,
      isWeekend: [0, 6].includes(tableData.weekdayIndexByRow[rowIndex] ?? 1),
      isSognehelligdag: tableData.isSognehelligdagByIndex[rowIndex] ?? false,
      isArbejdsdag: tableData.isWorkdayByIndex[rowIndex] ?? false,
      tafFlags: tableData.tafFlagsByIndex[rowIndex] ?? new Set<string>(),
      svieSmerte: tableData.svieSmerteByIndex[rowIndex] ?? 'Ingen',
    };
  });
};

export const eoSnapshotToDebugView = (args: Readonly<{
  snapshot?: EoSnapshot | null;
  appSettings: AppSettings;
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>>;
}>): EoDebugView => {
  const snapshot = args.snapshot ?? null;
  if (!snapshot?.data?.debugSnapshot) {
    if (snapshot?.status === 'fail_closed') {
      return {
        kind: 'blocked',
        severity: 'error',
        title: 'EO debug er blokeret',
        message: snapshot.invariants[0]?.message ?? 'Der opstod en intern fejl i EO-snapshot.',
      };
    }

    return {
      kind: 'blocked',
      severity: 'info',
      title: 'EO debug kræver et friskt snapshot',
      message: 'Åbn debug-fanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.',
    };
  }

  const debugSnapshot = snapshot.data.debugSnapshot;
  const stamdataValues = debugSnapshot.stamdataValues;
  const erstatningsopgoerelseValues = debugSnapshot.eoValues;
  const canonicalOutput = snapshot.data.canonicalOutput;
  const debugDays = buildDebugDaysFromSnapshot(debugSnapshot);

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
    rowsBySection: buildRowsBySection(ctx),
    loenSections: buildLoenDebugSections(buildLoenTimeline({
      debugDays,
      eoValues: erstatningsopgoerelseValues,
      stamdataValues,
    })),
    regulationSections: buildRegulationDebugSections(buildRegulationTimeline({
      debugDays,
      eoValues: erstatningsopgoerelseValues,
      stamdataValues,
    })),
  };
};

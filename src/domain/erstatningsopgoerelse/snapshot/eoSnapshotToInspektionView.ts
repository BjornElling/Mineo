import type { AppSettings } from '../../../settings/appSettingsSchema';
import {
  EO_ROW_BUILDERS,
  executeEoRowBuilderEntriesBySection,
} from '../../eoRowEvaluation/eoRowBuilderRegistry';
import type { EoRowEvaluationContext } from '../../eoRowEvaluation/eoRowExecutionContext';
import { buildRegulationTimeline } from '../../eoInspektion/eoInspektionRegulationCore';
import type { RegulationInspektionSection } from '../../eoInspektion/eoInspektionRegulationViewModel';
import { buildRegulationInspektionSections } from '../../eoInspektion/eoInspektionRegulationViewModel';
import type { SectionId } from '../../eoRowEvaluation/eoRowNavigationMap';
import type { EoRowModel } from '../../eoRowEvaluation/eoRowTypes';
import type { EoCanonicalOutput } from './eoCanonicalOutput';
import type { EoModel } from './eoPresentationModel';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';

type EoInspektionViewBlocked = Readonly<{
  kind: 'blocked';
  severity: 'info' | 'error';
  title: string;
  message: string;
}>;

type EoInspektionViewReady = Readonly<{
  kind: 'ready';
  canonicalOutput: EoCanonicalOutput | undefined;
  inspektionSnapshot: NonNullable<EoSnapshot['inspektionSnapshot']>;
  stamdataValues: NonNullable<EoSnapshot['input']['stamdata']>;
  erstatningsopgoerelseValues: NonNullable<EoSnapshot['input']['erstatningsopgoerelse']>;
  rowsBySection: ReadonlyMap<SectionId, readonly EoRowModel[]>;
  regulationSections: readonly RegulationInspektionSection[];
  pdfModel?: EoModel | undefined;
}>;

export type EoInspektionView = EoInspektionViewBlocked | EoInspektionViewReady;
export type { EoInspektionViewReady };

export const eoSnapshotToInspektionView = (args: Readonly<{
  snapshot?: EoSnapshot | null;
  appSettings: AppSettings;
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>>;
}>): EoInspektionView => {
  const snapshot = args.snapshot ?? null;
  if (!snapshot) {
    return {
      kind: 'blocked',
      severity: 'info',
      title: 'EO-gennemsyn kræver et friskt snapshot',
      message: 'Åbn gennemsynsfanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.',
    };
  }

  // fail_closed routes altid til fejlvisning — uanset om inspektionSnapshot er tilstede.
  if (snapshot.status === 'fail_closed') {
    return {
      kind: 'blocked',
      severity: 'error',
      title: 'EO-gennemsyn er blokeret',
      message: snapshot.invariants[0]?.message ?? 'Der opstod en intern fejl i EO-snapshot.',
    };
  }

  const inspektionSnapshot = snapshot.inspektionSnapshot;
  if (inspektionSnapshot) {
    const stamdataValues = inspektionSnapshot.stamdataValues;
    const erstatningsopgoerelseValues = inspektionSnapshot.eoValues;
    const canonicalOutput = hasEoSnapshotData(snapshot) ? snapshot.data.canonicalOutput : undefined;
    const pdfModel = hasEoSnapshotData(snapshot) ? snapshot.data.pdfModel : undefined;

    const ctx: EoRowEvaluationContext = {
      stamdataValues,
      stamdataErrors: inspektionSnapshot.fieldErrors.stamdata,
      eoValues: erstatningsopgoerelseValues,
      eoErrors: inspektionSnapshot.fieldErrors.erstatningsopgoerelse,
      loenindkomstManuelReguleringInputErrors: args.loenindkomstManuelReguleringInputErrors,
      appSettings: args.appSettings,
      canonicalOutput,
      pdfModel,
    };

    return {
      kind: 'ready',
      canonicalOutput,
      inspektionSnapshot,
      stamdataValues,
      erstatningsopgoerelseValues,
      rowsBySection: executeEoRowBuilderEntriesBySection(EO_ROW_BUILDERS, ctx),
      regulationSections: buildRegulationInspektionSections({
        timeline: buildRegulationTimeline({
          inspektionDays: inspektionSnapshot.inspektionDays,
          eoValues: erstatningsopgoerelseValues,
          stamdataValues,
        }),
        canonicalOutput,
        eoValues: erstatningsopgoerelseValues,
        stamdataValues,
      }),
      pdfModel,
    };
  }

  // Alle ikke-fail_closed snapshots har gyldigt input, men manglende inspektionSnapshot
  // skyldes at valideringen blokerede engine-kørslen. Vis den relevante fejlbesked.
  return {
    kind: 'blocked',
    severity: 'info',
    title: 'EO-gennemsyn kræver et gyldigt inspektions-snapshot',
    message: 'Ret valideringsfejlene i sagen og åbn gennemsynsfanen igen for at bygge gennemsynet på korrekt committede data.',
  };
};

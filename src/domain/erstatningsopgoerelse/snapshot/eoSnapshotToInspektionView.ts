import type { EoRowPolicy } from '../../../settings/sourceSettings';
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
import { safeCompute } from '../../../utils/safeComputation';
import { isErr } from '../../../types/result';

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

/**
 * Fanen uden kontrolgrundlag. Teksten talte før om «snapshot» og «committed data» og bad brugeren åbne fanen igen,
 * men grundlaget kommer først, når beregningens fejl er rettet (BB-389). Kontroltabellen siger det samme.
 */
const EO_KONTROL_BEREGNING_STOPPET: EoInspektionViewBlocked = Object.freeze({
  kind: 'blocked',
  severity: 'info',
  title: 'EO-kontrol kan ikke vises, fordi beregningen er stoppet',
  message: 'Se «Fejl og advarsler» under Beregning.',
});
export type { EoInspektionViewReady };

export const eoSnapshotToInspektionView = (args: Readonly<{
  snapshot?: EoSnapshot | null;
  rowPolicy: EoRowPolicy;
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>>;
}>): EoInspektionView => {
  const snapshot = args.snapshot ?? null;
  if (!snapshot) {
    return EO_KONTROL_BEREGNING_STOPPET;
  }

  // fail_closed routes altid til fejlvisning – uanset om inspektionSnapshot er tilstede.
  if (snapshot.status === 'fail_closed') {
    return {
      kind: 'blocked',
      severity: 'error',
      title: 'EO-kontrol er blokeret',
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
      rowPolicy: args.rowPolicy,
      canonicalOutput,
      pdfModel,
    };

    const regulationSectionsResult = safeCompute(() => {
      const timeline = buildRegulationTimeline({
        eoValues: erstatningsopgoerelseValues,
        stamdataValues,
        loenudvikling: pdfModel?.tabtArbejdsfortjeneste.loenudvikling ?? null,
      });
      return buildRegulationInspektionSections({
        timeline,
        canonicalOutput,
        loenudvikling: pdfModel?.tabtArbejdsfortjeneste.loenudvikling,
        eoValues: erstatningsopgoerelseValues,
        stamdataValues,
      });
    }, 'EOInspektion.regulationSections', { code: 'eo_inspektion:regulation_projection' });

    if (isErr(regulationSectionsResult)) {
      return {
        kind: 'blocked',
        severity: 'error',
        title: 'EO-kontrol er blokeret',
        message: 'Reguleringsdelen i EO-kontrol kunne ikke vises, fordi kontrolgrundlaget er inkonsistent.',
      };
    }

    return {
      kind: 'ready',
      canonicalOutput,
      inspektionSnapshot,
      stamdataValues,
      erstatningsopgoerelseValues,
      rowsBySection: executeEoRowBuilderEntriesBySection(EO_ROW_BUILDERS, ctx),
      regulationSections: regulationSectionsResult.value,
      pdfModel,
    };
  }

  // Alle ikke-fail_closed snapshots har gyldigt input, men manglende inspektionSnapshot
  // skyldes at valideringen blokerede engine-kørslen. Vis den relevante fejlbesked.
  return EO_KONTROL_BEREGNING_STOPPET;
};

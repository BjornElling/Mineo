import type { TafPerYearResult } from '../engines/tafPerYearDerived';
import type { TafPerYearOpreguleretResult } from '../engines/tafPerYearOpreguleretDerived';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
} from './eoSnapshotInvariants';
import type { EoModel } from '../shared/eoTypes';

export type TafPerYearOpreguleretPdfDocument = Readonly<{
  model: EoModel;
  /** Per-år TAF (oprindelige beløb) – grundlaget der opreguleres. */
  presentation: TafPerYearResult | null;
  /** Opreguleret per-år TAF til beregningsåret. */
  opreguleret: TafPerYearOpreguleretResult | null;
}>;

export type TafPerYearOpreguleretPdfDocumentProjection =
  | Readonly<{ kind: 'ok'; document: TafPerYearOpreguleretPdfDocument }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const eoSnapshotToTafPerYearOpreguleretPdfDocument = (
  snapshot: EoSnapshot
): TafPerYearOpreguleretPdfDocumentProjection => {
  const blockingInvariants = getBlockingInvariantsForOutput(snapshot.invariants, 'taf_per_year_opreguleret_pdf');
  const blockedMessage = buildBlockingMessageForOutput(
    snapshot.invariants,
    'taf_per_year_opreguleret_pdf',
    'TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag.'
  );
  if (!hasEoSnapshotData(snapshot)) {
    return {
      kind: 'blocked',
      message: blockedMessage,
      invariants: blockingInvariants,
    };
  }

  if (blockingInvariants.length > 0) {
    return {
      kind: 'blocked',
      message: blockedMessage,
      invariants: blockingInvariants,
    };
  }

  // pdfModel og engine-resultater er bygget og caches i computeEoSnapshot —
  // konsistens mod totals er garanteret af snapshot-pipelinen.
  return {
    kind: 'ok',
    document: {
      model: snapshot.data.pdfModel,
      presentation: snapshot.data.engines.tafPerYear,
      opreguleret: snapshot.data.engines.tafPerYearOpreguleret,
    },
  };
};

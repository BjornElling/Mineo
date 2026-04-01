import type { TafPerYearResult } from '../engines/tafPerYearDerived';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
} from './eoSnapshotInvariants';
import type { PdfModel } from '../pdf/eoPdfModelTypes';

export type TafPerYearPdfDocument = Readonly<{
  model: PdfModel;
  presentation: TafPerYearResult | null;
}>;

export type TafPerYearPdfDocumentProjection =
  | Readonly<{ kind: 'ok'; document: TafPerYearPdfDocument }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const eoSnapshotToTafPerYearPdfDocument = (snapshot: EoSnapshot): TafPerYearPdfDocumentProjection => {
  const blockingInvariants = getBlockingInvariantsForOutput(snapshot.invariants, 'taf_per_year_pdf');
  const blockedMessage = buildBlockingMessageForOutput(
    snapshot.invariants,
    'taf_per_year_pdf',
    'TAF fordelt på år kan ikke genereres for den aktuelle sag.'
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

  // pdfModel er bygget og caches i computeEoSnapshot — konsistens mod totals er garanteret
  // af snapshot-pipelinen og kan ikke afvige.
  return {
    kind: 'ok',
    document: {
      model: snapshot.data.pdfModel,
      presentation: snapshot.data.engines.tafPerYear,
    },
  };
};

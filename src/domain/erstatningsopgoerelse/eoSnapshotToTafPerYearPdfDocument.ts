import type { TafPerYearResult } from './tafPerYearDerived';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
  getEoPdfDocumentTotalsMismatchInvariant,
} from './eoSnapshotInvariants';
import { buildEoPdfDocumentFromSnapshot } from './eoSnapshotToEoPdfDocument';
import type { PdfModel } from './eoPdfModel';
import { logError } from '../../utils/logger';

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

  const model = buildEoPdfDocumentFromSnapshot(snapshot);
  const totalsMismatchInvariant = getEoPdfDocumentTotalsMismatchInvariant(model, snapshot);
  if (totalsMismatchInvariant) {
    logError('TAF-per-år dokumentmodel matcher ikke snapshot-totalerne', {
      context: 'eoSnapshotToTafPerYearPdfDocument.documentTotalsMismatch',
      error: new Error(totalsMismatchInvariant.message),
      data: {
        revision: snapshot.revision,
        evidence: totalsMismatchInvariant.evidence,
      },
    });
    return {
      kind: 'blocked',
      message: totalsMismatchInvariant.message,
      invariants: [totalsMismatchInvariant],
    };
  }

  return {
    kind: 'ok',
    document: {
      model,
      presentation: snapshot.data.engines.tafPerYear,
    },
  };
};

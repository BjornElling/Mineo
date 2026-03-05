import type { TafPerYearResult } from './tafPerYearDerived';
import type { EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import { getBlockingInvariantsForOutput } from './eoSnapshotInvariants';
import { buildEoPdfDocumentFromSnapshot } from './eoSnapshotToEoPdfDocument';
import type { PdfModel } from './eoPdfModel';

export type TafPerYearPdfDocument = Readonly<{
  model: PdfModel;
  presentation: TafPerYearResult | null;
}>;

export type TafPerYearPdfDocumentProjection =
  | Readonly<{ kind: 'ok'; document: TafPerYearPdfDocument }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

const buildBlockingMessage = (snapshot: EoSnapshot, fallback: string): string => {
  const messages = getBlockingInvariantsForOutput(snapshot.invariants, 'taf_per_year_pdf').map((invariant) => invariant.message);
  if (messages.length === 0) return fallback;
  return messages.join('; ');
};

export const eoSnapshotToTafPerYearPdfDocument = (snapshot: EoSnapshot): TafPerYearPdfDocumentProjection => {
  const blockingInvariants = getBlockingInvariantsForOutput(snapshot.invariants, 'taf_per_year_pdf');
  if (snapshot.status === 'fail_closed' || !snapshot.data) {
    return {
      kind: 'blocked',
      message: buildBlockingMessage(snapshot, 'TAF fordelt på år kan ikke genereres for den aktuelle sag.'),
      invariants: blockingInvariants,
    };
  }

  if (blockingInvariants.length > 0) {
    return {
      kind: 'blocked',
      message: buildBlockingMessage(snapshot, 'TAF fordelt på år kan ikke genereres for den aktuelle sag.'),
      invariants: blockingInvariants,
    };
  }

  const model = buildEoPdfDocumentFromSnapshot(snapshot);
  if (!model) {
    return {
      kind: 'blocked',
      message: buildBlockingMessage(snapshot, 'TAF fordelt på år kan ikke genereres for den aktuelle sag.'),
      invariants: blockingInvariants,
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

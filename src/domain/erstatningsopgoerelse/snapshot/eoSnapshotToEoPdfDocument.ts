import type { EoModel } from '../shared/eoTypes';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
} from './eoSnapshotInvariants';

export type EoPdfDocumentProjection =
  | Readonly<{ kind: 'ok'; document: EoModel }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const eoSnapshotToEoPdfDocument = (snapshot: EoSnapshot): EoPdfDocumentProjection => {
  const blockingInvariants = getBlockingInvariantsForOutput(snapshot.invariants, 'eo_pdf');
  const blockedMessage = buildBlockingMessageForOutput(
    snapshot.invariants,
    'eo_pdf',
    'EO-PDF kan ikke genereres for den aktuelle sag.'
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
    document: snapshot.data.pdfModel,
  };
};

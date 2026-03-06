import { buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPdfBuilders';
import { buildErstatningsopgoerelsePdfModelFromComputed, type PdfModel } from './eoPdfModel';
import { hasEoSnapshotData, type EoSnapshot, type EoSnapshotWithData } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
  getEoPdfDocumentTotalsMismatchInvariant,
} from './eoSnapshotInvariants';
import { logError } from '../../utils/logger';

export type EoPdfDocumentProjection =
  | Readonly<{ kind: 'ok'; document: PdfModel }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const buildEoPdfDocumentFromSnapshot = (snapshot: EoSnapshotWithData): PdfModel => {
  const stamdata = snapshot.input.stamdata;
  const eoValues = snapshot.input.erstatningsopgoerelse;
  const forlig = snapshot.data.engines.forlig
    ? {
      erIndgaaet: true,
      label: snapshot.data.engines.forlig.label,
      dato: eoValues.forligDato ?? null,
      factor: snapshot.data.engines.forlig.factor,
    } as const
    : {
      erIndgaaet: false,
      label: null,
      dato: null,
      factor: null,
    } as const;

  return buildErstatningsopgoerelsePdfModelFromComputed({
    presentation: snapshot.data.presentation,
    svieSmerte: buildSvieSmerteModel(eoValues, stamdata, { engine: snapshot.data.engines.svieSmerte }),
    tabtArbejdsfortjeneste: buildTabtArbejdsfortjenesteModel(eoValues, stamdata, {
      tafNetto: snapshot.data.engines.tafNetto,
      tafRanges: snapshot.data.canonicalOutput.periodiseringer.tafPerioder,
    }),
    oevrigeKrav: snapshot.data.engines.oevrigeKrav,
    forlig,
  });
};

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

  const document = buildEoPdfDocumentFromSnapshot(snapshot);
  const totalsMismatchInvariant = getEoPdfDocumentTotalsMismatchInvariant(document, snapshot);
  if (totalsMismatchInvariant) {
    logError('EO-PDF dokumentmodel matcher ikke snapshot-totalerne', {
      context: 'eoSnapshotToEoPdfDocument.documentTotalsMismatch',
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
    document,
  };
};

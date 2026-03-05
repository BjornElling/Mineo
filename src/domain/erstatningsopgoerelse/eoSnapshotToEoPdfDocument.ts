import { buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPdfBuilders';
import { buildErstatningsopgoerelsePdfModelFromComputed, type PdfModel } from './eoPdfModel';
import type { EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import { getBlockingInvariantsForOutput } from './eoSnapshotInvariants';

const buildBlockingMessage = (snapshot: EoSnapshot, fallback: string): string => {
  const messages = getBlockingInvariantsForOutput(snapshot.invariants, 'eo_pdf').map((invariant) => invariant.message);
  if (messages.length === 0) return fallback;
  return messages.join('; ');
};

export type EoPdfDocumentProjection =
  | Readonly<{ kind: 'ok'; document: PdfModel }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const buildEoPdfDocumentFromSnapshot = (snapshot: EoSnapshot): PdfModel | null => {
  if (!snapshot.data || !snapshot.input.stamdata || !snapshot.input.erstatningsopgoerelse) {
    return null;
  }

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
    }),
    oevrigeKrav: snapshot.data.engines.oevrigeKrav,
    forlig,
  });
};

export const eoSnapshotToEoPdfDocument = (snapshot: EoSnapshot): EoPdfDocumentProjection => {
  const blockingInvariants = getBlockingInvariantsForOutput(snapshot.invariants, 'eo_pdf');
  if (snapshot.status === 'fail_closed' || !snapshot.data) {
    return {
      kind: 'blocked',
      message: buildBlockingMessage(snapshot, 'EO-PDF kan ikke genereres for den aktuelle sag.'),
      invariants: blockingInvariants,
    };
  }

  if (blockingInvariants.length > 0) {
    return {
      kind: 'blocked',
      message: buildBlockingMessage(snapshot, 'EO-PDF kan ikke genereres for den aktuelle sag.'),
      invariants: blockingInvariants,
    };
  }

  const document = buildEoPdfDocumentFromSnapshot(snapshot);
  if (!document) {
    return {
      kind: 'blocked',
      message: buildBlockingMessage(snapshot, 'EO-PDF kan ikke genereres for den aktuelle sag.'),
      invariants: blockingInvariants,
    };
  }

  return {
    kind: 'ok',
    document,
  };
};

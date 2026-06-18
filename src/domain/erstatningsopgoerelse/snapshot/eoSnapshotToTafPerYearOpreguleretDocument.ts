import type { TafPerYearResult } from '../engines/tafPerYearDerived';
import type { TafPerYearOpreguleretResult } from '../engines/tafPerYearOpreguleretDerived';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
} from './eoSnapshotInvariants';
import { tafBeregningsgrundlagAngivetLoenMangler } from './eoSnapshotToTafPerYearDocument';
import type { EoModel } from '../shared/eoTypes';

export type TafPerYearOpreguleretDocument = Readonly<{
  model: EoModel;
  /** Per-år TAF (oprindelige beløb) – grundlaget der opreguleres. */
  presentation: TafPerYearResult | null;
  /** Opreguleret per-år TAF til beregningsåret. */
  opreguleret: TafPerYearOpreguleretResult | null;
}>;

export type TafPerYearOpreguleretDocumentProjection =
  | Readonly<{ kind: 'ok'; document: TafPerYearOpreguleretDocument }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const eoSnapshotToTafPerYearOpreguleretDocument = (
  snapshot: EoSnapshot
): TafPerYearOpreguleretDocumentProjection => {
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

  // Bloker download når der ikke er TAF fordelt på år — på linje med "Visuel graf over
  // indtægtsniveau" og "TAF-krav fordelt på kalenderår".
  const presentation = snapshot.data.engines.tafPerYear;
  if (!presentation || presentation.years.length === 0) {
    const message = snapshot.data.engines.tafNetto.harTafPerioder
      ? 'TAF opreguleret til beregningsåret kan ikke genereres, fordi TAF ikke kan fordeles på år.'
      : 'TAF opreguleret til beregningsåret kan ikke genereres, fordi der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden.';
    return { kind: 'blocked', message, invariants: [] };
  }

  if (tafBeregningsgrundlagAngivetLoenMangler(snapshot.data.pdfModel)) {
    // Fail-closed: ingen teknisk "Fejl (...)"-tekst i et tillidskritisk dokument (A2/A5).
    return {
      kind: 'blocked',
      message:
        'Beregningsgrundlaget for tabt arbejdsfortjeneste mangler den angivne måneds-/dagsløn. Udfyld lønnen, før dokumentet kan dannes.',
      invariants: [],
    };
  }

  // pdfModel og engine-resultater er bygget og caches i computeEoSnapshot —
  // konsistens mod totals er garanteret af snapshot-pipelinen.
  return {
    kind: 'ok',
    document: {
      model: snapshot.data.pdfModel,
      presentation,
      opreguleret: snapshot.data.engines.tafPerYearOpreguleret,
    },
  };
};

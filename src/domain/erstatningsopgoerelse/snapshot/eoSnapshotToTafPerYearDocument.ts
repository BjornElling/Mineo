import type { TafPerYearResult } from '../engines/tafPerYearDerived';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
} from './eoSnapshotInvariants';
import type { EoModel } from '../shared/eoTypes';

export type TafPerYearDocument = Readonly<{
  model: EoModel;
  presentation: TafPerYearResult | null;
}>;

/**
 * Fail-closed guard for begge TAF-dokumenter: når TAF beregnes ud fra en manuelt angivet
 * måneds-/dagsløn, og det beløb mangler, er den værdi der ville blive udskrevet i
 * "Beregningsgrundlag" ikke beregnelig. Dokument-laget ville ellers udskrive en teknisk
 * "Fejl (...)"-tekst i et tillidskritisk dokument. Vi blokerer i stedet download (A2/A5), så
 * skadelidte aldrig ser en fejlkode. Kun "TAF opreguleret til beregningsåret" udskriver denne værdi
 * (via Beregningsgrundlag-sektionen), så guarden anvendes kun dér – ikke i dette base-dokument, der
 * ikke udskriver måneds-/dagsløn-værdien direkte.
 */
export const tafBeregningsgrundlagAngivetLoenMangler = (model: EoModel): boolean => {
  const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;
  if (!indkomst) return false;
  if (indkomst.beregnesUdFra === 'Angivet månedsløn') return indkomst.maanedsloen.status !== 'ok';
  if (indkomst.beregnesUdFra === 'Angivet dagsløn') return indkomst.dagsloen.status !== 'ok';
  return false;
};

export type TafPerYearDocumentProjection =
  | Readonly<{ kind: 'ok'; document: TafPerYearDocument }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

export const eoSnapshotToTafPerYearDocument = (snapshot: EoSnapshot): TafPerYearDocumentProjection => {
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

  // Bloker download når der ikke er TAF fordelt på år – på linje med "Visuel graf over
  // indtægtsniveau". Skeln årsagen: uden TAF-perioder beregnes der slet ingen tabt
  // arbejdsfortjeneste (hyppigste tilfælde), modsat at en faktisk TAF-beregning ikke kan fordeles.
  const presentation = snapshot.data.engines.tafPerYear;
  if (!presentation || presentation.years.length === 0) {
    const message = snapshot.data.engines.tafNetto.harTafPerioder
      ? 'TAF-krav fordelt på kalenderår kan ikke genereres, fordi TAF ikke kan fordeles på år.'
      : 'Dokumentet kan ikke genereres, fordi der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden.';
    return { kind: 'blocked', message, invariants: [] };
  }

  // pdfModel er bygget og caches i computeEoSnapshot – konsistens mod totals er garanteret
  // af snapshot-pipelinen og kan ikke afvige.
  return {
    kind: 'ok',
    document: {
      model: snapshot.data.pdfModel,
      presentation,
    },
  };
};

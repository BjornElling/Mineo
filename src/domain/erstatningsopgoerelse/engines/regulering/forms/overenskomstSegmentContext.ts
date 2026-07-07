import type { DanishDateString, ISODateString } from '../../../../../types/branded';
import { isoToDanish } from '../../../../../types/branded';
import { round2 as roundToTwoDecimals } from '../../../../../utils/roundingShortcuts';
import {
  getGrundloenAngivetPerForOverenskomst,
  resolveOverenskomstRef,
  type OverenskomstRef,
} from '../../../../../data/overenskomstRates';
import { TAF_BEREGNES_SOM } from '../../../helpers/tafBeregningsenhed';
import { convertAnciennitetSats } from '../../../helpers/eoSharedUtils';
import type { KonsolideretLoenudvikling } from '../reguleringForm';

// R6 — overenskomst er splittet i to selvindeholdte segment-byggere (privat pakke-indeks og
// offentlig løntrin), fordi de er to fundamentalt forskellige former der før delte én
// funktionskrop langs en gren. Dette modul samler det de *faktisk* deler: uniformitets-
// konsolideringen (i overenskomstForm) plus preamblen her — reference-opslag og det
// anciennitetstillæg begge byggere anvender. Selve base-/segment-opslaget deler de ikke, og
// de to bevidst forskellige clamp-mekanismer (U4) bor hver i sin bygger.

/** Den konsoliderede overenskomst-variant (fælles for privat og offentlig gren). */
export type KonsolideretOverenskomst = Extract<KonsolideretLoenudvikling, { strategi: 'overenskomst' }>;

/** Anciennitetstillæg der er aktivt fra en given dato, delt af begge segment-byggere. */
export type AnciennitetForIndex = Readonly<{
  // Segment-gate + brudpunkt: clampet op til TAF-start (et anciennitetstillæg dateret før
  // TAF-perioden slår igennem fra første TAF-dag). Bruges til segment-splitting og pr.-segment-gate.
  activeFromIso: ISODateString;
  // Basis-gate: den rå (u-clampede) anciennitetsdato. Basis/referenceniveauet skal indeholde
  // tillægget, hvis det allerede gælder på (den effektive) reguleringsdato — dvs. sammenlignet med
  // den rå dato, ikke den TAF-clampede (jf. bruger-beslutning 2026-07-07: "basis skal indeholde
  // tillægget"). Uden dette regnede motoren tillægget som lønudvikling oven på en basis uden det,
  // så det udbetalte beløb ikke matchede det viste reguleringsindeks.
  rawActiveFromIso: ISODateString;
  supplementValue: number;
}>;

/**
 * De form-agnostiske værdier begge overenskomst-byggere har brug for: reguleringsdatoen i ISO
 * og dansk format, den resolvede overenskomst-reference og et evt. anciennitetstillæg.
 */
export type OverenskomstSegmentContext = Readonly<{
  reguleringsdatoIso: ISODateString;
  reguleringsdatoDa: DanishDateString;
  overenskomstRef: OverenskomstRef;
  anciennitetForIndex: AnciennitetForIndex | null;
}>;

const resolveAnciennitetForIndex = (konsolideret: KonsolideretOverenskomst): AnciennitetForIndex | null => {
  if (!konsolideret.harAnciennitetstillaegEfterSkadedatoen) return null;
  const anciennitetDato = konsolideret.anciennitetstillaegDato;
  const satsValue = konsolideret.anciennitetstillaegSatsValue;
  if (!anciennitetDato || typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
    return null;
  }
  const tafStartIso = konsolideret.tafRanges.reduce<ISODateString | undefined>(
    (min, range) => (!min || range.fra < min ? range.fra : min),
    undefined
  );
  const tafEndIso = konsolideret.tafRanges.reduce<ISODateString | undefined>(
    (max, range) => (!max || range.til > max ? range.til : max),
    undefined
  );
  if (!tafStartIso || !tafEndIso) return null;
  if (anciennitetDato > tafEndIso) return null;

  const tafBeregnesSom = konsolideret.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måneder' : 'Arbejdsdage';
  const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(konsolideret.overenskomstId, tafBeregnesSom);
  if (!grundloenAngivetPer) return null;

  const supplementValue = convertAnciennitetSats(
    satsValue,
    konsolideret.anciennitetstillaegSatsAngivesPer,
    grundloenAngivetPer
  );

  const roundedSupplement = roundToTwoDecimals(supplementValue);
  if (!Number.isFinite(roundedSupplement) || roundedSupplement <= 0) return null;
  return {
    activeFromIso: anciennitetDato < tafStartIso ? tafStartIso : anciennitetDato,
    rawActiveFromIso: anciennitetDato,
    supplementValue: roundedSupplement,
  };
};

/**
 * Bygger den fælles preamble begge segment-byggere ankres i. Fail-closed på manglende/ugyldig
 * reguleringsdato eller ukendt overenskomst (uændret fra den tidligere fælles funktionskrop).
 */
export const buildOverenskomstSegmentContext = (
  konsolideret: KonsolideretOverenskomst
): OverenskomstSegmentContext => {
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }
  const reguleringsdatoIso = konsolideret.reguleringsdato;
  const overenskomstRef = konsolideret.overenskomstId ? resolveOverenskomstRef(konsolideret.overenskomstId) : undefined;
  const reguleringsdatoDa = isoToDanish(reguleringsdatoIso);
  if (!overenskomstRef) {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
  }
  if (!reguleringsdatoDa) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldig reguleringsdato');
  }
  return {
    reguleringsdatoIso,
    reguleringsdatoDa,
    overenskomstRef,
    anciennitetForIndex: resolveAnciennitetForIndex(konsolideret),
  };
};

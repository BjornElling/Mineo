import type { DanishDateString, ISODateString } from '../../../../../types/branded';
import { isoToDanish } from '../../../../../types/branded';
import {
  resolveOverenskomstRef,
  type OverenskomstRef,
} from '../../../../../data/overenskomstRates';
import {
  resolveAnciennitetForIndex,
  type AnciennitetForIndex,
} from '../../overenskomstReguleringShared';
import type { KonsolideretLoenudvikling } from '../reguleringForm';

// R6 — overenskomst er splittet i to selvindeholdte segment-byggere (privat pakke-indeks og
// offentlig løntrin), fordi de er to fundamentalt forskellige former der før delte én
// funktionskrop langs en gren. Dette modul samler det de *faktisk* deler: uniformitets-
// konsolideringen (i overenskomstForm) plus preamblen her — reference-opslag og det
// anciennitetstillæg begge byggere anvender. Selve base-/segment-opslaget deler de ikke, og
// de to bevidst forskellige clamp-mekanismer (U4) bor hver i sin bygger. Anciennitetstillæggets
// resolution deles nu med præsentation og kontrol via `resolveAnciennitetForIndex`.

/** Den konsoliderede overenskomst-variant (fælles for privat og offentlig gren). */
export type KonsolideretOverenskomst = Extract<KonsolideretLoenudvikling, { strategi: 'overenskomst' }>;

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

const resolveKonsolideretAnciennitet = (konsolideret: KonsolideretOverenskomst): AnciennitetForIndex | null => {
  const tafStartIso = konsolideret.tafRanges.reduce<ISODateString | undefined>(
    (min, range) => (!min || range.fra < min ? range.fra : min),
    undefined
  );
  const tafEndIso = konsolideret.tafRanges.reduce<ISODateString | undefined>(
    (max, range) => (!max || range.til > max ? range.til : max),
    undefined
  );
  if (!tafStartIso || !tafEndIso) return null;
  return resolveAnciennitetForIndex({
    harAnciennitetstillaeg: konsolideret.harAnciennitetstillaegEfterSkadedatoen,
    anciennitetstillaegDatoIso: konsolideret.anciennitetstillaegDato,
    satsValue: konsolideret.anciennitetstillaegSatsValue,
    satsAngivesPer: konsolideret.anciennitetstillaegSatsAngivesPer,
    overenskomstId: konsolideret.overenskomstId,
    tafBeregningsenhed: konsolideret.tafBeregningsenhed,
    periodeStartIso: tafStartIso,
    periodeEndIso: tafEndIso,
  });
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
    anciennitetForIndex: resolveKonsolideretAnciennitet(konsolideret),
  };
};

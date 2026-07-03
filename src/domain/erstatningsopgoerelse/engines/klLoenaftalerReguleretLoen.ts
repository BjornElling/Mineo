/**
 * KL-lønaftaler: trinvis (kæde-)opregulering af løn med afrunding på hvert trin.
 *
 * SÆRLIG KL-LØNAFTALER-LOGIK — se det normative overblik i
 * docs/domain/taf/kl-loenaftaler-regulering.md (forklarer hvorfor denne
 * reguleringsform har en anden beregningsmetode og andre visninger end de øvrige
 * reguleringsmodeller).
 *
 * Modsat de øvrige reguleringsmodeller (der fremskriver via ét samlet indeksforhold
 * fra basisdatoen) regulerer KL-lønaftaler-modellen skadelidtes løn trin for trin:
 *
 *   løn_0 = basisløn (på reguleringsdatoen)
 *   løn_i = afrund_til_2_decimaler( løn_{i-1} × (1 + periodesats_i / 100) )
 *
 * dvs. lønnen opreguleres til næstkommende reguleringssats, afrundes til to
 * decimaler, og den afrundede værdi opreguleres så til den næste sats osv. Dette
 * er bevidst beregningsteknisk unøjagtigt (afrundingen akkumulerer), men afspejler
 * den fremgangsmåde, der ønskes for KL-lønaftalerne.
 *
 * Resolveren bruges af beregningsmotoren og præsentationslaget til den regulerede
 * løn. `deltaPctAt` er kun en intern bro til eksisterende segmentforbrugere;
 * reguleringsformen KL-lønaftaler må ikke vise akkumuleret regulering brugervendt.
 */

import type { ISODateString } from '../../../types/branded';
import { roundByMethod } from '../../../utils/rounding';
import { roundKroner } from '../shared/eoMoney';
import { parseDanishToIso } from '../helpers/eoSharedUtils';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';

export type KlLoenaftalerReguleretLoenResolver = Readonly<{
  /** Den opregulerede, afrundede løn (kroner, 2 decimaler) der gælder på en given dato. */
  loenAt: (iso: ISODateString) => number;
  /**
   * Akkumuleret regulering fra reguleringsdatoen til en given dato (procentpoint).
   * Afledt af den afrundede løn: (løn(dato) / basisløn − 1) × 100. Holdes i fuld
   * præcision, så TAF-beløbet bliver præcis `afrund(løn × antal)`.
   */
  deltaPctAt: (iso: ISODateString) => number;
}>;

/**
 * Bygger en KL-lønaftaler-kæde-resolver fra en basisløn (på reguleringsdatoen) og frem over
 * KL-lønaftalernes reguleringsdatoer. Reguleringsdatoer på eller før selve
 * reguleringsdatoen springes over — basislønnen afspejler allerede lønniveauet dér.
 */
export const buildKlLoenaftalerReguleretLoenResolver = (
  baseLoenRounded: number,
  reguleringsdatoIso: ISODateString
): KlLoenaftalerReguleretLoenResolver => {
  // Kæden bygges direkte fra kilde-rækkerne (dato OG periodesats fra samme række), så
  // de to aldrig kan komme ud af sync via et separat opslag. Rækkerne sorteres eksplicit
  // ældste-først, uafhængigt af kildens lagringsrækkefølge.
  const klLoenaftalerTrinAsc = klLoenaftalerRaekker
    .map((entry) => {
      const iso = parseDanishToIso(entry.fraDato);
      // Fail-closed: en KL-lønaftaler-række med uparsbar dato må aldrig stille springes
      // over — det ville tabe et reguleringstrin (tavs under-regulering). Alle kilde-datoer
      // er valide danske datoer (jf. data/klLoenaftaler.ts + test), så dette er en defensiv
      // invariant, der fanges som runtime_exception (jf. loenudviklingBeregning.ts:63–70).
      if (!iso) {
        throw new Error('Loenudvikling kan ikke beregnes: uparsbar KL-lønaftaler-dato');
      }
      return { iso, pct: entry.reguleringPct };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));

  // Kæden: basis ved reguleringsdatoen, derefter ét trin pr. efterfølgende KL-lønaftaler-dato.
  const chain: Array<Readonly<{ fromIso: ISODateString; loen: number }>> = [
    { fromIso: reguleringsdatoIso, loen: baseLoenRounded },
  ];
  let current = baseLoenRounded;
  for (const { iso, pct } of klLoenaftalerTrinAsc) {
    // Reguleringsdatoer på/før selve reguleringsdatoen springes bevidst over — basislønnen
    // afspejler allerede lønniveauet dér.
    if (iso <= reguleringsdatoIso) continue;
    // Fail-closed: en ikke-finit periodesats må aldrig stille springes over (samme
    // under-regulerings-risiko som ovenfor). Defensiv invariant.
    if (!Number.isFinite(pct)) {
      throw new Error('Loenudvikling kan ikke beregnes: ikke-finit KL-lønaftaler-periodesats');
    }
    current = roundKroner(current * (1 + pct / 100));
    chain.push({ fromIso: iso, loen: current });
  }

  const loenAt = (iso: ISODateString): number => {
    let loen = baseLoenRounded;
    for (const entry of chain) {
      if (entry.fromIso > iso) break;
      loen = entry.loen;
    }
    return loen;
  };

  const deltaPctAt = (iso: ISODateString): number => {
    if (baseLoenRounded <= 0) return 0;
    // Afrund til 8 decimaler: fjerner flydende-komma-støj (fx 1,3000000000000067 → 1,3)
    // og holder samtidig rigeligt præcision til, at afrund(basisløn × (1 + deltaPct/100))
    // reproducerer den kæde-opregulerede løn nøjagtigt.
    return roundByMethod((loenAt(iso) / baseLoenRounded - 1) * 100, 8, 'halfAwayFromZero');
  };

  return { loenAt, deltaPctAt };
};

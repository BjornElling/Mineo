import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { hasIndtastetLoenoplysninger } from '../standardLoen/loenoplysningerInput';

/**
 * ÉT sandt sted for «skal Feriegodtgørelse/-tillæg være udfyldt?» – på BEGGE lønflader (M-37,
 * udviklerafgørelse 2026-10-30: «de to skal generelt følges ad, så hvis vi senere ændrer forudsætningen,
 * ændres den begge steder»).
 *
 * Et tomt felt er en manglende indtastning, ikke en forkert: ingen rød ring (brugeren har ikke skrevet noget),
 * men en blokerende linje i «Fejl og advarsler» med `FERIE_PCT_MANGLER_BESKED` (BB-274 på EO, M-37 på Årsløn).
 * Før regnede Årsløn et tomt felt stille som 0 %, mens en indtastet `1` gav en advarsel.
 *
 * Kravet gælder, når tre ting er sande:
 * - satserne er i brug – tillæggene angives i procent (Procent eller Overenskomst), ikke som beløb i tabellen;
 * - løntabellen har indtastede beløb;
 * - satsen OPGØRES som feriegodtgørelse.
 *
 * Det tredje er den ene, bevidste forskel mellem fladerne (`feriepenge-begreber-contract.md` regel 2–3):
 * EO opgør altid ydelsen beregningsteknisk som feriegodtgørelse, også ved løn under ferie, så dér er kravet
 * ubetinget. Årsløn regner med den faktiske ydelse: ved fuld løn under ferie er satsen ferietillægget, som kan
 * være 0, så feltet må stå tomt dér.
 */
export type FeriePctKravInput = Readonly<{
  satserErIBrug: boolean;
  loenraekker: readonly StandardLoenTableRow[];
  satsenOpgoeresSomFeriegodtgoerelse: boolean;
}>;

export const erFeriePctPaakraevet = (input: FeriePctKravInput): boolean =>
  input.satserErIBrug
  && input.satsenOpgoeresSomFeriegodtgoerelse
  && hasIndtastetLoenoplysninger(input.loenraekker);

/** Linjen i «Fejl og advarsler» – ens på begge flader. */
export const FERIE_PCT_MANGLER_BESKED = 'Feriegodtgørelse/-tillæg er ikke udfyldt';

/** Over denne sats gives en ikke-blokerende advarsel på begge lønflader (BB-286). */
export const FERIE_PCT_ADVARSELSGRAENSE = 20;

/** Ordlyd og grænse deles; de to domæners øvrige feriekrav er forskellige. */
export const resolveHoejFeriePctAdvarsel = (feriePct: number | undefined): string | undefined =>
  feriePct !== undefined && feriePct > FERIE_PCT_ADVARSELSGRAENSE
    ? `Feriegodtgørelse/-tillæg over ${String(FERIE_PCT_ADVARSELSGRAENSE)} % er usædvanligt – kontrollér satsen`
    : undefined;

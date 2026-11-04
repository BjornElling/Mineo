/**
 * ÉT sandt sted for, hvad satsen i «Feriegodtgørelse/-tillæg» BETYDER – på begge lønflader
 * (`feriepenge-begreber-contract.md` §2d, udviklerafgørelse 2026-11-04).
 *
 * Feltet rummer to forskellige ydelser, og den indtastede sats afgør, hvilken der er tale om:
 * - under 12 % er det et **ferietillæg** (1 % – eller et forhøjet ferietillæg på typisk op til ca. 3 %) – lønmodtageren
 *   har løn under ferie;
 * - 12 % og derover er det **feriegodtgørelse** (12 %, 12,5 % eller 15 % ved ret til 6. ferieuge, evt. med et
 *   forhøjet ferietillæg lagt oven i) – lønmodtageren har ikke løn under ferie.
 *
 * Feltets label skifter IKKE med indtastningen; al anden brugervendt tekst om satsen bruger ydelsens rigtige navn
 * gennem {@link ferieYdelseNavn}.
 */

/** Skillelinjen: en sats herunder er et ferietillæg, en sats herfra er feriegodtgørelse. */
export const FERIEGODTGOERELSE_MIN_PCT = 12;

/** Over denne sats gives en ikke-blokerende advarsel på begge lønflader (BB-286). */
export const FERIE_PCT_ADVARSELSGRAENSE = 20;

/** Feriegodtgørelse er aldrig over denne sats; en højere indtastning er en rød feltfejl på begge flader. */
export const FERIE_PCT_MAKS = 25;

/** Feltets eget, generiske navn – bruges kun, hvor der ingen sats er at navngive ydelsen efter (et tomt felt). */
export const FERIE_SATS_FELTNAVN = 'Feriegodtgørelse/-tillæg';

export type FerieYdelse = 'feriegodtgoerelse' | 'ferietillaeg';

export const resolveFerieYdelse = (feriePct: number): FerieYdelse =>
  feriePct < FERIEGODTGOERELSE_MIN_PCT ? 'ferietillaeg' : 'feriegodtgoerelse';

const FERIE_YDELSE_NAVN: Readonly<Record<FerieYdelse, string>> = Object.freeze({
  feriegodtgoerelse: 'Feriegodtgørelse',
  ferietillaeg: 'Ferietillæg',
});

/** Ydelsens navn efter satsen («Feriegodtgørelse»/«Ferietillæg»); uden sats feltets generiske navn. */
export const ferieYdelseNavn = (feriePct: number | undefined): string =>
  feriePct === undefined ? FERIE_SATS_FELTNAVN : FERIE_YDELSE_NAVN[resolveFerieYdelse(feriePct)];

/**
 * Ydelsen for flere satser under ét (fx en tabelkolonne): den fælles ydelse, eller `undefined`, når satserne er
 * blandede eller ingen – en kolonne med både 1 % og 12,5 % rummer netop begge ydelser og navngives generisk.
 */
export const resolveFaellesFerieYdelse = (satser: readonly number[]): FerieYdelse | undefined => {
  const ydelser = new Set(satser.map(resolveFerieYdelse));
  const [eneste] = [...ydelser];
  return ydelser.size === 1 ? eneste : undefined;
};

/** Den røde feltfejl over {@link FERIE_PCT_MAKS} – ens på begge flader og i den manuelle lønudviklingstabel. */
export const FERIE_PCT_OVER_MAKS_BESKED = `Feriegodtgørelse kan ikke overstige ${String(FERIE_PCT_MAKS)} %`;

/**
 * Den gule advarsel mellem {@link FERIE_PCT_ADVARSELSGRAENSE} og {@link FERIE_PCT_MAKS}. Over maksimum har feltet sin
 * egen røde fejl, så advarslen tier dér (højst ét fund pr. felt). Satsen er her altid feriegodtgørelse.
 */
export const resolveHoejFeriePctAdvarsel = (feriePct: number | undefined): string | undefined =>
  feriePct !== undefined && feriePct > FERIE_PCT_ADVARSELSGRAENSE && feriePct <= FERIE_PCT_MAKS
    ? `Feriegodtgørelse over ${String(FERIE_PCT_ADVARSELSGRAENSE)} % er usædvanligt – kontrollér satsen`
    : undefined;

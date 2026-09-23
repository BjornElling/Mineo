import type { JaNejSkjul } from '../../../../schemas/formSchemas/enumSchemas';

/**
 * Beregning-fanens sammendrag skriver de tre krav med SAMME ord for samme tilstand.
 *
 * «Nej» dækkede før tre forskellige tilstande – kravet er fravalgt, kravet er opbrugt, og perioderne mangler
 * endnu – så et «Nej» ud for en tom tabel læstes som «det emne er afsluttet» (BB-227). Svie/smerte fik
 * derfor sine egne ord; TAF og øvrige krav følger nu de samme (BB-234, udviklerafgørelse 2026-09-23).
 * «Skjul» har samme beregningsadfærd som «Nej», men udelades helt fra opgørelsen, og det markeres, så det
 * er tydeligt, at emnet er fravalgt fra dokumentet – ikke kun opgjort til 0 kr.
 *
 * Returnerer `undefined`, når kravet er rejst; så viser rækken kravets egne linjer.
 */
export const resolveKravIkkeRejstTekst = (kravvalg: JaNejSkjul): string | undefined => {
  if (kravvalg === 'Skjul') return 'Ikke rejst (skjult)';
  if (kravvalg !== 'Ja') return 'Ikke rejst';
  return undefined;
};

/** Et rejst krav uden en eneste periode eller post. */
export const INGEN_PERIODER_ANGIVET_TEKST = 'Ingen perioder angivet';
export const INGEN_POSTER_ANGIVET_TEKST = 'Ingen poster angivet';

/**
 * Øvrige krav-rækken viser antallet af poster, ikke beløbet (BB-226's afgørelse: sammendraget viser, hvilke
 * ydelser der indgår, ikke hvad de beløber sig til).
 */
export const resolveOevrigeKravSummaryText = (args: Readonly<{
  kravvalg: JaNejSkjul;
  harFejl: boolean;
  antalPoster: number;
}>): string => {
  const ikkeRejst = resolveKravIkkeRejstTekst(args.kravvalg);
  if (ikkeRejst !== undefined) return ikkeRejst;
  if (args.harFejl) return 'Fejl';
  if (args.antalPoster === 0) return INGEN_POSTER_ANGIVET_TEKST;
  return args.antalPoster === 1 ? '1 post' : `${args.antalPoster} poster`;
};

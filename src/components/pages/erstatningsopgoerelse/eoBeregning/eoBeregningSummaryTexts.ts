import type { JaNejSkjul } from '../../../../schemas/formSchemas/enumSchemas';

/**
 * Beregning-fanens sammendrag skriver de tre krav med SAMME ord for samme tilstand.
 *
 * Ét «Nej» for tre forskellige tilstande – kravet er fravalgt, kravet er opbrugt, og perioderne mangler
 * endnu – ville få et «Nej» ud for en tom tabel til at læses som «det emne er afsluttet». Hver tilstand har
 * derfor sine egne ord, og svie/smerte, TAF og øvrige krav følger de samme (bevidst valg).
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
 * Et rejst krav, hvis perioder alle ligger uden for EO-perioden. «Ingen perioder angivet» ville her modsige den
 * tabel, brugeren lige har udfyldt.
 */
export const INGEN_PERIODE_I_EO_PERIODEN_TEKST = 'Ingen periode i EO-perioden';

/**
 * Øvrige krav-rækken viser antallet af poster, ikke beløbet (bevidst valg: sammendraget viser, hvilke
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

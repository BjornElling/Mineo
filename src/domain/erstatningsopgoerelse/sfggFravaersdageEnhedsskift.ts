import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { formatDanishList } from '../../utils/danishListFormatting';
import { resolveSfggDayBasis, resolveSfggSource, type SfggDayBasis } from './engines/sfggKilde';
import { erSfggFeltRelevant } from './helpers/eoLoenindkomstRelevance';
import { ansaettelsesforholdNavne, resolveAnsaettelsesforholdNavn } from './helpers/indtaegtPerioder';
import { computeTafBeregningsenhed } from './helpers/tafBeregningsenhed';

/**
 * Om et valg skifter enheden for sygeferiegodtgørelsens «Evt. ferie- og fraværsdage uden løn».
 *
 * BAGGRUND: Enheden er ikke et valg på feltet, men følger opgørelsen: kalenderdage, når kortets kilde går via en
 * referenceperiode OG TAF opgøres i måneder – ellers arbejdsdage (`resolveSfggDayBasis`). TAF-enheden er sagsbred
 * (`computeTafBeregningsenhed`): «Beregnes ud fra» har forrang, og ved beregningsperiode slår ét kort med indtastet
 * løn i perioden og «Løn på helligdage» ≠ «Almindelig løn» eller «Fuld løn under ferie» ≠ «Ja» HELE sagen over i
 * arbejdsdage. Et valg på ét kort kan derfor skifte enheden på et andet kort. Tallet bevares, men tæller i den nye
 * enhed – en indtastet uge på 7 kalenderdage bliver til 7 arbejdsdage. Kalderen spørger derfor, før valget
 * committes; tallet omregnes ikke, fordi fraværets datoer ikke kendes.
 *
 * Funktionen sammenligner tilstanden før og efter valget og afgør dermed selv, om valget overhovedet flytter
 * enheden – kalderen skal ikke kende reglen.
 */
export type SfggEnhedsskiftValues = Pick<
  ErstatningsopgoerelseValues,
  | 'kravPaaTabtArbejdsfortjeneste'
  | 'beregnesUdFra'
  | 'tafBeregningsperiodeFra'
  | 'tafBeregningsperiodeTil'
  | 'loenindkomstAnsaettelsesforhold'
  | 'sfggAnsaettelsesforhold'
>;

export type SfggEnhedsskiftKort = Readonly<{
  ansaettelsesforholdId: string;
  /** Kortets navn efter den kanoniske navneregel (`resolveAnsaettelsesforholdNavn`). */
  navn: string;
  fravaersdage: number;
}>;

export type SfggFravaersdageEnhedsskift = Readonly<{
  nyEnhed: SfggDayBasis;
  /** Kortene, hvor et indtastet antal (> 0) skifter enhed – i skærmens rækkefølge. */
  kort: readonly SfggEnhedsskiftKort[];
}>;

type Employment = SfggEnhedsskiftValues['loenindkomstAnsaettelsesforhold'][number];

const resolveKortEnhed = (values: SfggEnhedsskiftValues, af: Employment): SfggDayBasis | undefined => {
  const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === af.id);
  // Kun et vist felt kan skifte enhed for brugeren – samme relevans som sektionen og descriptoren.
  const relevant = erSfggFeltRelevant('referenceperiode', {
    kravPaaTabtArbejdsfortjeneste: values.kravPaaTabtArbejdsfortjeneste,
    employment: af,
    sfggBeregningskilde: row?.sfggBeregningskilde,
  });
  if (!relevant) return undefined;
  return resolveSfggDayBasis(resolveSfggSource(row, af), computeTafBeregningsenhed(values));
};

/** `null`, når valget ikke flytter enheden for et indtastet antal på noget kort. */
export const resolveSfggFravaersdageEnhedsskift = (
  foer: SfggEnhedsskiftValues,
  efter: SfggEnhedsskiftValues,
): SfggFravaersdageEnhedsskift | null => {
  const navne = ansaettelsesforholdNavne(foer.loenindkomstAnsaettelsesforhold);
  const kort: SfggEnhedsskiftKort[] = [];
  let nyEnhed: SfggDayBasis | undefined;
  foer.loenindkomstAnsaettelsesforhold.forEach((afFoer, index) => {
    const fravaersdage = foer.sfggAnsaettelsesforhold
      .find((entry) => entry.ansaettelsesforholdId === afFoer.id)?.sfggReferenceperiodeFravaersdageUdenLoen;
    if (fravaersdage === undefined || fravaersdage <= 0) return;
    const afEfter = efter.loenindkomstAnsaettelsesforhold.find((entry) => entry.id === afFoer.id);
    if (afEfter === undefined) return;
    const enhedFoer = resolveKortEnhed(foer, afFoer);
    const enhedEfter = resolveKortEnhed(efter, afEfter);
    if (enhedFoer === undefined || enhedEfter === undefined || enhedFoer === enhedEfter) return;
    // Alle berørte kort får samme nye enhed: et skift kræver referenceperiode-sporet, og der afgøres enheden
    // alene af den sagsbrede TAF-enhed.
    nyEnhed = enhedEfter;
    kort.push({
      ansaettelsesforholdId: afFoer.id,
      navn: resolveAnsaettelsesforholdNavn(afFoer.navnPaaArbejdssted, index, navne),
      fravaersdage,
    });
  });
  return nyEnhed === undefined ? null : { nyEnhed, kort };
};

/** Bekræftelsens tekst, fx «Fraværsdagene uden løn (7 på Firma A og 3 på Firma B) tælles herefter som arbejdsdage. Kontrollér antallet.» */
export const formatSfggFravaersdageEnhedsskiftBesked = (skift: SfggFravaersdageEnhedsskift): string => {
  const opremsning = formatDanishList(skift.kort.map((entry) => `${String(entry.fravaersdage)} på ${entry.navn}`));
  return `Fraværsdagene uden løn (${opremsning}) tælles herefter som ${skift.nyEnhed}. Kontrollér antallet.`;
};

/** Tilstanden efter et valg på ét ansættelsesforhold – til sammenligningen ovenfor. */
export const medAnsaettelsesforholdValg = <TValues extends SfggEnhedsskiftValues>(
  values: TValues,
  ansaettelsesforholdId: string,
  aendring: Partial<Employment>,
): TValues => ({
  ...values,
  loenindkomstAnsaettelsesforhold: values.loenindkomstAnsaettelsesforhold.map((af) =>
    af.id === ansaettelsesforholdId ? { ...af, ...aendring } : af),
});

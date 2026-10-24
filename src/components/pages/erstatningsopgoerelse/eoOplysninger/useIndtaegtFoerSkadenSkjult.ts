import * as React from 'react';

/**
 * Skjult-tilstanden for «Indtægt før skaden» på EO-oplysninger, med værn mod at grundlaget forsvinder, mens
 * brugeren taster i det (udviklerafgørelse 2026-10-24).
 *
 * `kanSkjules` (`kanIndkomstBeregningenSkjules`) skifter til sand i det øjeblik, grundlaget bliver gyldigt – fx
 * når den sidste dato i beregningsperioden er indtastet i opgørelse nr. 2, fordi grundlaget var tomt i nr. 1.
 * Fulgte fladen det direkte, klappede sektionen sammen under brugeren uden varsel. Reglen er derfor:
 *
 *  - Mens fanen er synlig, går sektionen kun fra VIST til SKJULT, når brugeren selv ændrer komprimeringen – dvs.
 *    slår togglen til eller gør opgørelsen til en senere opgørelse (`komprimeringValgt` skifter). Ellers bliver en
 *    vist sektion stående resten af besøget, også når grundlaget bliver gyldigt.
 *  - Den modsatte vej er altid åben: bliver grundlaget ugyldigt, vises det straks, så fejlen kan ses og rettes.
 *  - Et nyt besøg starter forfra: når fanen ikke er synlig (en anden EO-fane), følger tilstanden `kanSkjules`
 *    direkte, og forlader brugeren siden, afmonteres den. Et grundlag, der blev gyldigt, er dermed skjult, når
 *    brugeren vender tilbage. Indlæsning af en sag og «Slet alt» fører til Stamdata og er altså også et nyt besøg.
 *
 * Tilstanden er bevidst kun komponent-state: den er et visningshensyn under ét besøg og hverken sagsdata,
 * gemmes i `.eo` eller overlever en genindlæsning.
 */

export type IndtaegtFoerSkadenVisningInput = Readonly<{
  /** EO-oplysninger er den aktive fane. Fanen er altid monteret og skjules med `display: none`. */
  fanenErAktiv: boolean;
  /** Togglen er «Ja» i en senere opgørelse (`skalKomprimereIndkomstBeregning`). */
  komprimeringValgt: boolean;
  /** Komprimeringen er valgt OG grundlaget er gyldigt (`kanIndkomstBeregningenSkjules`). */
  kanSkjules: boolean;
}>;

export type IndtaegtFoerSkadenVisning = Readonly<{
  komprimeringValgt: boolean;
  skjult: boolean;
}>;

/** Den rene overgang bag `useIndtaegtFoerSkadenSkjult`; `forrige === null` er første render. */
export const resolveIndtaegtFoerSkadenVisning = (
  forrige: IndtaegtFoerSkadenVisning | null,
  input: IndtaegtFoerSkadenVisningInput,
): IndtaegtFoerSkadenVisning => {
  const nyStart = forrige === null || !input.fanenErAktiv || forrige.komprimeringValgt !== input.komprimeringValgt;
  return {
    komprimeringValgt: input.komprimeringValgt,
    skjult: nyStart ? input.kanSkjules : forrige.skjult && input.kanSkjules,
  };
};

export function useIndtaegtFoerSkadenSkjult(input: IndtaegtFoerSkadenVisningInput): boolean {
  const [visning, setVisning] = React.useState(() => resolveIndtaegtFoerSkadenVisning(null, input));
  const naeste = resolveIndtaegtFoerSkadenVisning(visning, input);
  // Afledt state opdateres under render (Reacts mønster for state, der afhænger af den forrige værdi), så en
  // sektion, der skal skjules eller vises, aldrig når skærmen i den forældede tilstand først.
  if (naeste.skjult !== visning.skjult || naeste.komprimeringValgt !== visning.komprimeringValgt) {
    setVisning(naeste);
  }
  return naeste.skjult;
}

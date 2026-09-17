/**
 * Feltets erklærede tegn- og cifferlofter – ÉT sted, alle descriptorer henter dem fra.
 *
 * **Hvorfor modulet findes.** `input-field-behavior-contract.md` §1.2 kræver, at ethvert felt, brugeren
 * skriver i, har en effektiv blokering mod tegn og længde, der ikke passer feltet. Kravet var universelt
 * erklæret, men kun håndhævet dér, hvor nogen huskede det: målingen 2026-08-15 fandt 28 af 31 tekstfelter
 * og 8 af 12 heltalsfelter uden nogen grænse overhovedet. Det er nøjagtig samme fejlmåde som datofelternes
 * manglende grænser (§2.1, 31 af 54), og den er lukket på samme måde – grænsen er gjort PÅKRÆVET i typen
 * (`createTextFieldCodec`, `createIntegerFieldCodec`), og adfærden måles af et harness.
 *
 * **Hvorfor tallene bor her og ikke på hvert kaldssted.** Et loft skrevet i hånden pr. descriptor er et
 * loft, der kan drifte: to felter med samme rolle får forskellig grænse, og ingen kan se det. Tierne
 * nedenfor er de udviklergodkendte kategorier (2026-08-15), så et nyt felt vælger en KATEGORI frem for et
 * tal.
 *
 * **Loft, ikke tilladelse (§8).** Grænserne her afgrænser alene, hvor mange tegn der kan komme ind i
 * feltet. De løsner aldrig en strengere regel, feltet allerede har, og de gælder kun brugerens
 * indtastning – ikke `.eo`-load, programmatiske skrivninger eller beregnede værdier (§1.2).
 */

/**
 * Korte enkeltlinjefelter: navne, numre, referencer og korte fritekstangivelser.
 *
 * 60 tegn rummer et langt personnavn, et journalnummer eller en overenskomstbetegnelse, men afviser en
 * indsat sætning eller et helt dokument.
 */
export const SHORT_TEXT_MAX_LENGTH = 60;

/**
 * Bilagsnumre – meget korte referencer i et smalt, centreret felt.
 *
 * Felterne arvede `SHORT_TEXT_MAX_LENGTH` (60) fra kategorien ovenfor, men de er 130 px brede og
 * centrerede: 60 tegn måler ~515 px, så brugeren kunne se ca. en fjerdedel af sin egen indtastning,
 * taget fra midten, uden tooltip at læse resten i (BB-206). En grænse, feltet kun kan vise en brøkdel
 * af, afværger intet og gør en fejlagtig indsættelse fra et andet dokument umulig at opdage.
 *
 * 12 tegn er rundeligt til de former, der reelt forekommer («3», «3-7», «Bilag 12-14»), og er stadig
 * læsbart i feltets bredde. Målestokken er udviklerens egen (2026-08-16): antallet af tilladte tegn skal
 * svare til det synlige indhold – samme afvejning som bag «Nummer»-feltets 7 tegn.
 */
export const BILAGSNUMMER_MAX_LENGTH = 12;

/**
 * De flerlinjede kommentarfelter (`MultilineTextField`).
 *
 * 512 er ikke et nyt tal: det er præcis det loft, `Kommentarer` på Offentlige ydelser allerede havde
 * (kontraktens §3.4). De to øvrige kommentarfelter – EO's `Særlige bemærkninger` og Renteberegningens
 * `Kommentarer` – havde intet og får nu det samme.
 */
export const COMMENT_TEXT_MAX_LENGTH = 512;

/**
 * Heltalsfelter, hvis domæne ikke har noget øvre maksimum – i praksis «antal dage»-felterne.
 *
 * Felter, der HAR et maksimum, afleder deres cifferantal af det (méngrad 1–120 → 3 cifre), så
 * indtastningsgrænsen og talværdigrænsen ikke kan sige hver sit. 9999 dage er ca. 27 år og ligger langt
 * over enhver reel sag, men afviser den utilsigtede tastning eller indsættelse af et langt tal.
 */
export const UNBOUNDED_DAY_COUNT_MAX_DIGITS = 4;

/**
 * Antal cifre, der skal til for at skrive `maxValue`.
 *
 * Bruges af de heltalsfelter, der har et erklæret maksimum, så cifferloftet ALTID følger maksimum og de
 * to ikke kan komme fra hinanden ved en senere ændring af grænsen. Fortegnet tælles ikke med – det er
 * `signPolicy`, der afgør, om det overhovedet kan tastes.
 */
export const digitsRequiredFor = (maxValue: number): number => {
  if (!Number.isInteger(maxValue) || maxValue < 0) {
    throw new Error('digitsRequiredFor: maxValue skal være et ikke-negativt heltal');
  }
  return String(maxValue).length;
};

import { FORHOEJET_PENSIONSALDER_LABEL } from './eetLabels';

/**
 * Label til "Beregnet differencekrav"-rækken på differencekrav-fanen og i PDF'en.
 *
 * Når et gyldigt forlig om ansvarsgrad under 100 % er anvendt, vises forligs-label og det fulde
 * (ureducerede) krav i parentes, fx:
 *   "Beregnet differencekrav (2/3 af 1.095.121 kr.)"
 * Ved intet forlig (eller 100 %) vises blot "Beregnet differencekrav".
 *
 * `foerForligFormatted` skal være det allerede formaterede fulde krav (fx "1.095.121 kr.") – denne
 * funktion formaterer bevidst ikke selv beløb, så UI og PDF deler præcis samme tekst.
 */
export const buildBeregnetDifferencekravLabel = (
  forligLabel: string | null,
  foerForligFormatted: string
): string => {
  return forligLabel === null
    ? 'Beregnet differencekrav'
    : `Beregnet differencekrav (${forligLabel} af ${foerForligFormatted})`;
};

/**
 * Linjen under en DELVIST ENDELIG afgørelse, hvis løbende ydelse ikke fradrages (skader fra
 * 16. juni 2011).
 *
 * Teksten hed «Løbende ydelser derfor ikke relevante.» – programmets stærkeste påstand om et
 * fradrag: at der ikke er noget at fradrage. To sider længere inde i SAMME dokument stod den samme
 * afgørelse med sine periodelinjer og «I alt 66.827 kr.», og ordet «derfor» henviste til en
 * forbeholdssætning om MIDLERTIDIGE ydelser, altså en afgørelsestype rækken ikke har (BB-187).
 *
 * Reglen er, at en delvist endelig afgørelses løbende ydelse i praksis ER en midlertidig ydelse –
 * afgørelsen afviger alene ved, at en del af den har kunnet kapitaliseres. Linjen siger derfor det,
 * kort, og forbinder rækken med forbeholdet ovenfor uden at gentage hele reglen.
 */
export const DELVIST_ENDELIG_LOEBENDE_YDELSE_TEKST =
  'Den løbende ydelse er midlertidig og fradrages derfor ikke.';

/** Sumrækken under mer-erstatningens forhøjelser – vises kun ved mere end én forhøjelse. */
export const SAMLET_MER_ERSTATNING_LABEL = 'Samlet mer-erstatning';

/**
 * Overskriften over én forhøjelse af folkepensionsalderen.
 *
 * Overskriften BÆRER den kapitalisering, forhøjelsen regulerer. To kapitaliseringer i samme sag
 * rammes af samme forhøjelse og gav ellers to ordret identiske overskrifter med to forskellige beløb
 * (BB-193) – på skærmen i to bokse og i specifikationen i to fradragslinjer, hvor den eneste forskel
 * lå inde i blokken («Grundydelse (15 %)» mod «(25 %)»). Brugeren kunne da hverken se, hvilken
 * kapitalisering en linje hørte til, eller efterprøve nogen af dem, og to identiske overskrifter
 * læses let som en dublet, han tror han skal slette.
 *
 * Funktionen formaterer bevidst ikke selv – kalderen leverer formaterede strenge, så skærm og
 * dokument deler præcis samme tekst med hver sin datoform (lang i overskrifter, kort indlejret).
 */
export const buildMerErstatningForhoejelseOverskrift = (args: Readonly<{
  forhoejelsesdatoFormatted: string;
  gammelAlderLabel: string;
  nyAlderLabel: string;
  kapitaliseringspctFormatted: string;
  kapitaliseringsdatoFormatted: string;
}>): string =>
  `Forhøjelse pr. ${args.forhoejelsesdatoFormatted} (${args.gammelAlderLabel} → ${args.nyAlderLabel})`
  + ` · kapitaliseret (${args.kapitaliseringspctFormatted}) den ${args.kapitaliseringsdatoFormatted}`;

/**
 * Hvorfor bilagsvalget «Forhøjet pensionsalder» er inaktivt.
 *
 * Bilagsvalget skjules ikke, når der ikke er noget bilag at vælge (jf. `page-component-contract.md`
 * §"Bilagsvalg og andre betingede afkrydsningsfelter"): det vises inaktivt og umarkeret med årsagen i
 * tooltippet, så brugeren kan se, at valget findes, og hvorfor det ikke kan vælges lige nu.
 *
 * Rækkefølgen er bevidst og dækker TRE tilstande med tre grunde (BB-189):
 *  1. Brugerens eget fravalg forklares FØRST. Er togglen sat til Nej, er mer-erstatningen slet ikke
 *     beregnet, og en påstand om lovgivningen ville da handle om et regnestykke, programmet ikke har
 *     udført.
 *  2. Findes der ingen kapitalisering, er DET grunden. Beregningen kaldes ikke, fordi vagten
 *     `input.indregnMerErstatning && kapResult.computation` fejler på sit andet led – ikke fordi
 *     pensionsalderen står uændret. Den tidligere fælles tekst var her direkte usand: i den målte sag
 *     blev folkepensionsalderen forhøjet 31-12-2020, midt i sagens periode, og programmet kendte
 *     datoen. Brugeren havde netop slået beregningen TIL og fik et svar om lovgivningen, som var
 *     forkert, og som han ikke havde anledning til at betvivle.
 *  3. Først når beregningen ER kørt og fandt ingen forhøjelse, er «Pensionsalderen er ikke forhøjet i
 *     perioden» en sand påstand.
 *
 * `null` betyder, at bilaget kan vælges (feltet er aktivt).
 */
export const resolveMerErstatningPensionsalderBilagDisabledReason = (
  indregnMerErstatning: boolean,
  harMerErstatning: boolean,
  harKapitaliseringer: boolean
): string | null => {
  if (!indregnMerErstatning) return `${FORHOEJET_PENSIONSALDER_LABEL} er fravalgt nedenfor`;
  if (!harKapitaliseringer) return 'Der er ingen kapitalisering at forhøje';
  if (!harMerErstatning) return 'Pensionsalderen er ikke forhøjet i perioden';
  return null;
};

/**
 * Hvorfor bilagsvalget "Proformakap. af rest-EET" er inaktivt.
 *
 * Fradraget for det resterende erhvervsevnetab opgøres på ÉN af to måder, aldrig begge: er der mere end
 * to år til folkepensionsalderen på beregningsdatoen, proformakapitaliseres resten; ellers opgøres den som
 * resterende løbende ydelser. Der er derfor to grunde til, at bilaget ikke kan vælges – ingen rest-EET at
 * opgøre, eller en rest der er opgjort som løbende ydelser og altså ikke har et proformabilag.
 *
 * `null` betyder, at bilaget kan vælges (feltet er aktivt).
 */
export const resolveProformaKapitaliseringBilagDisabledReason = (
  harProformaKapitalisering: boolean,
  harResterendeLoebendeYdelser: boolean
): string | null => {
  if (harProformaKapitalisering) return null;
  if (harResterendeLoebendeYdelser) return 'Resten er opgjort som løbende ydelser';
  return 'Der er intet rest-EET at proformakapitalisere';
};

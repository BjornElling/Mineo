import { createFieldWarning, type FieldWarning } from '../../inputCore/fieldWarning';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { ISODateString } from '../../types/branded';
import { isoYear } from '../../utils/isoDateHelpers';
import { aarsloenAslMax, type YearlyRate } from '../../data/lovbestemteRates';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import { ASL_AARSLOEN_MAX_NOTICE } from '../aslEalAarsloen/aslAarsloenMaxNotice';
import { SKAERING_2024_07_01 as EET_TITRIN_SKAERINGSDATO } from './eetSkaeringsdatoer';
import { formatISOToDanish } from '../../utils/dateFormatting';

type KapitaliseringsPctRow = Readonly<{ rowId: string; kapitaliseringspct: number }>;

/**
 * De EET-procenter, loven ikke tillader, men programmet alligevel regner på, advares gult – ikke rødt.
 *
 * Mindstegrænserne og de faste procentsatser kan juridisk ikke fraviges, men en teoretisk beregning
 * af en sådan værdi skal være mulig. Derfor advares der i stedet for at kalde en værdi «ugyldig», som
 * programmet i samme åndedrag regner på og trykker (BB-158).
 *
 * Advarslerne bærer bevidst INGEN hale om, at «beregningen derfor ikke er lovmæssig» (BB-173):
 * hvad der kan bruges juridisk, er brugerens vurdering, ikke programmets, og halen gav to advarsler
 * om samme grænse hver sin alvorsgrad. Advarslen navngiver grænsen; konsekvensen kender brugeren.
 * Tilføj den ikke igen – heller ikke for en enkelt advarsel.
 *
 * Kun EET-procentens FORM er en rød fejl: den skal være delelig med 5, større end 0 og højst 100.
 */

/** Kanonisk, ikke-blokerende feltadvarsel for EET-procenter under lovens minimum. */
export const EET_UNDER_15_WARNING = 'Der kan ikke tilkendes erhvervsevnetab under 15 %';

export const resolveEetUnder15Warning = (value: number | undefined): FieldWarning | undefined =>
  value !== undefined && value > 0 && value < 15 ? createFieldWarning(EET_UNDER_15_WARNING) : undefined;

/**
 * Kanonisk advarsel for en EET-procent uden for de faste trin, der gælder skader fra 1. juli 2024.
 *
 * Fra den dato fastsættes erhvervsevnetabet i trin af 10 %. Reglen afhænger af SKADEDATOEN, som ikke
 * står i den celle, brugeren taster i, så advarslen skal stå ved feltet – ellers får han en neutral
 * celle og opdager det først på en anden fane (BB-158). 15 % er lovligt uanset trinreglen.
 */
export const EET_TITRIN_FRA_2024_WARNING =
  'Erhvervsevnetab fastsættes i trin af 10 % for skader fra 1. juli 2024';

export const harEetTitrinAfvigelse = (
  value: number | undefined,
  skadedato: ISODateString | undefined
): boolean =>
  value !== undefined &&
  skadedato !== undefined &&
  skadedato >= EET_TITRIN_SKAERINGSDATO &&
  value > 15 &&
  value % 10 !== 0;

export const resolveEetTitrinWarning = (
  value: number | undefined,
  skadedato: ISODateString | undefined
): FieldWarning | undefined =>
  harEetTitrinAfvigelse(value, skadedato) ? createFieldWarning(EET_TITRIN_FRA_2024_WARNING) : undefined;

/**
 * Advarslen når en af sagens datoer ligger efter beregningsdatoen.
 *
 * Tidligere stod tre linjer over hinanden – en pr. datotype – i en boks på de faner, brugeren IKKE
 * taster på, mens alle tre celler stod neutrale. Tre linjer om én årsag læses som tre problemer, og
 * den ene rettelse (beregningsdatoen) blev ikke navngivet (BB-159). Nu siger boksen årsagen én
 * gang, og hver af de tre datoceller bærer sin egen gule feltadvarsel, hvor brugeren sidder.
 */
export const formatDatoEfterBeregningsdatoWarning = (beregningsdato: ISODateString): string =>
  `Beregningsdatoen (${formatISOToDanish(beregningsdato)}) ligger før sagens afgørelser.`;

export const formatDatoEfterBeregningsdatoFeltWarning = (
  datoLabel: string,
  beregningsdato: ISODateString
): string => `${datoLabel} ligger efter beregningsdatoen (${formatISOToDanish(beregningsdato)})`;

export const resolveDatoEfterBeregningsdatoWarning = (
  dato: ISODateString | undefined,
  beregningsdato: ISODateString | undefined,
  datoLabel: string
): FieldWarning | undefined =>
  dato !== undefined && beregningsdato !== undefined && dato > beregningsdato
    ? createFieldWarning(formatDatoEfterBeregningsdatoFeltWarning(datoLabel, beregningsdato))
    : undefined;

/** Kanonisk advarsel for en selvstændig kapitalisering under den lovbestemte tærskel. */
export const KAPITALISERING_UNDER_15_WARNING = 'Der er angivet kapitalisering med mindre end 15 %';

/**
 * Returnerer de kapitaliseringsrækker, der skal fremhæves.
 *
 * En forhøjelse fra fx 20 % til 30 % kan lovligt kapitalisere de yderligere 10 %. Derfor gælder
 * advarslen alene den første kapitalisering og den samlede kapitalisering – aldrig en senere
 * delkapitalisering isoleret. Rækkerne kommer fra kapitaliseringsmotorens færdige rækkefølge, så
 * feltadvarslen og resultatfanen vurderer nøjagtigt den samme kapitalisering.
 */
export const kapitaliseringUnder15WarningRowIds = (
  rows: readonly KapitaliseringsPctRow[]
): ReadonlySet<string> => {
  const first = rows[0];
  if (first === undefined) return new Set();
  const total = rows.reduce((sum, row) => sum + row.kapitaliseringspct, 0);
  if (first.kapitaliseringspct >= 15 && total >= 15) return new Set();
  // Summen under 15 indebærer altid også en første kapitalisering under 15, fordi alle kapitaliseringer
  // er positive. Begge betingelser står med vilje eksplicit, så den juridiske regel ikke forsvinder i en
  // senere refaktorering af rækkernes repræsentation.
  return new Set([first.rowId]);
};

export const resolveKapitaliseringUnder15Warning = (
  rowId: string,
  rows: readonly KapitaliseringsPctRow[]
): FieldWarning | undefined => kapitaliseringUnder15WarningRowIds(rows).has(rowId)
  ? createFieldWarning(KAPITALISERING_UNDER_15_WARNING)
  : undefined;

/**
 * Feltbeskeden når ASL-årslønnen står på skadesårets maksimum.
 *
 * Teksten ejes af det DELTE årslønsfelt, ikke af denne flade (BB-124): Forsørgertab havde sin egen,
 * handlingsanvisende formulering for præcis samme situation, og de to nåede hver sin halvdel af brugerne.
 * Skriv ikke en flade-lokal variant igen – ret den fælles konstant.
 */
export const EET_ASL_AARSLOEN_MAX_WARNING = ASL_AARSLOEN_MAX_NOTICE;

/**
 * Samme trigger som beregningens `warn-asl-aarsloen-is-max`, samlet så feltvisningen og beregningen ikke kan drifte.
 * EAL-feltet skal være tomt, fordi en allerede indtastet EAL-årsløn er det eksplicitte valg, advarslen skal opfordre
 * brugeren til at træffe.
 */
export const hasEetAslAarsloenMaxWarning = (
  aslAarsloen: AmountValue | undefined,
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
  aslAarsloenMax: YearlyRate = aarsloenAslMax,
): boolean => {
  const aslAarsloenValue = amountValueToNumber(aslAarsloen);
  const ealAarsloenValue = amountValueToNumber(ealAarsloen);
  if (ealAarsloenValue !== undefined || aslAarsloenValue === undefined || skadedato === undefined) {
    return false;
  }

  const maxAarsloen = resolveAslAarsloensmaksimumForAar(isoYear(skadedato), aslAarsloenMax);
  return maxAarsloen !== undefined && aslAarsloenValue === maxAarsloen;
};

export const resolveEetAslAarsloenMaxWarning = (
  aslAarsloen: AmountValue | undefined,
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
): FieldWarning | undefined =>
  hasEetAslAarsloenMaxWarning(aslAarsloen, ealAarsloen, skadedato)
    ? createFieldWarning(EET_ASL_AARSLOEN_MAX_WARNING)
    : undefined;

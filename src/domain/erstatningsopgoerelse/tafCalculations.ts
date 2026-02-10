import type { FerieperiodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { addDays, formatToISO, parseISODate } from '../../utils/dateUtils';
import { TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR } from './tafBeregningsenhed';

// TODO(a): Gennemgå hele appen for brug af begreberne "arbejdsdage" vs. "hverdage" og verificér at labels/tekster matcher beregningerne ift. fradrag/ikke-fradrag af SH-dage.

export const calculateKalenderdageInclusive = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): number | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  const days = countInclusiveUtcDays(fraDate, tilDate);
  return days !== null && days >= 1 ? days : null;
};

const toNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled context kind: ${String(value)}`);
};

export const calculateTafAntalMaaneder = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  _ferieperioder: readonly FerieperiodeRow[],
  _loseFeriedage: number,
  oevrigeFravaersdage: number = 0
): number | null => {
  const praecis = calculateTafAntalMaanederPraecis(
    fra,
    til,
    _ferieperioder,
    _loseFeriedage,
    oevrigeFravaersdage
  );
  if (praecis === null) return null;
  return Math.round(praecis * 100) / 100;
};

export const calculateTafAntalMaanederPraecis = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  _ferieperioder: readonly FerieperiodeRow[],
  _loseFeriedage: number,
  oevrigeFravaersdage: number = 0
): number | null => {
  /**
   * Inclusive day-by-day iteration is intentional:
   * - Month fractions depend on each calendar day.
   * - DST-safe because we advance by calendar day, not ms-diff.
   *
   * Centrale beregningsprincipper beregning og fraværsdage
   *
   * Domæneprincip (normativt):
   * - Der foretages to adskilte beregninger: beregningsgrundlaget (referenceperioden før skaden)
   *   og selve TAF-kravet. De opgøres altid efter samme princip: måneder eller arbejdsdage.
   * - Valget mellem måneder og arbejdsdage er beregningsteknisk og uafhængigt af lønperiode
   *   (månedsløn/dagsløn).
   *
   * Måneder:
   * - SH-dage og feriedage udgår aldrig, hverken af beregningsgrundlaget eller TAF-perioden.
   * - "Øvrigt fravær uden løn" reducerer kun beregningsgrundlaget (4,8% af en måned pr. dag),
   *   aldrig selve TAF-kravet.
   *
   * Øvrige fraværsdage i TAF-perioden:
   * - Hvis sådanne dage skal udgå af TAF-kravet, håndteres det ved at brugeren udelader dagene
   *   i de angivne TAF-perioder (ingen automatisk fradrag).
   */
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  // Opbyg set af alle dage i perioden
  const periodeDage = new Set<ISODateString>();
  let currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    periodeDage.add(formatToISO(currentDate));
    currentDate = addDays(currentDate, 1);
  }

  // Beregn måned-værdier: hver dag tæller som 1/antal-dage-i-måneden
  let antalMaaneder = 0;
  for (const isoStr of periodeDage) {
    const year = Number.parseInt(isoStr.slice(0, 4), 10);
    const month = Number.parseInt(isoStr.slice(5, 7), 10);
    const dageIMaaned = new Date(Date.UTC(year, month, 0)).getUTCDate();
    antalMaaneder += 1 / dageIMaaned;
  }

  // Fradrag for øvrigt fravær uden løn i beregningsgrundlaget (4,8 % måned pr. dag).
  const fravaersdageFradrag = toNonNegativeInt(oevrigeFravaersdage) * TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR;

  const resultat = antalMaaneder - fravaersdageFradrag;

  // Sørg for at resultatet aldrig bliver negativt
  const begrænsedResultat = Math.max(0, resultat);

  return begrænsedResultat;
};

export type ArbejdsdageBeregningskontekst =
  | Readonly<{ kind: 'beregningsgrundlag'; oevrigeFravaersdage: number }>
  | Readonly<{ kind: 'taf' }>;

export const calculateTafAntalArbejdsdage = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number,
  context: ArbejdsdageBeregningskontekst
): number | null => {
  const breakdown = calculateTafArbejdsdageBreakdown(fra, til, ferieperioder, loseFeriedage, context);
  return breakdown ? breakdown.tafDage : null;
};

export type TafArbejdsdageBreakdown = Readonly<{
  arbejdsdage: number;
  shDage: number;
  arbejdsdageMinusSH: number;
  feriedage: number;
  loseFeriedage: number;
  oevrigeFravaersdage: number;
  tafDage: number;
}>;

export const calculateTafArbejdsdageBreakdown = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number,
  context: ArbejdsdageBeregningskontekst
): TafArbejdsdageBreakdown | null => {
  /**
   * Domæneprincip (normativt):
   * - Der foretages to adskilte beregninger: beregningsgrundlaget (referenceperioden før skaden)
   *   og selve TAF-kravet. De opgøres altid efter samme princip: måneder eller arbejdsdage.
   * - Når TAF beregnes i arbejdsdage, skal SH-dage og feriedage udgå af både
   *   beregningsgrundlaget og TAF-perioden.
   * - Løse feriedage placeres på de første hverdage, der ikke i forvejen er SH-dage
   *   eller daterede feriedage. Der er separate indtastninger for løse feriedage i
   *   beregningsgrundlaget og TAF-perioden.
   * - "Øvrigt fravær uden løn" reducerer kun beregningsgrundlaget, aldrig selve TAF-kravet.
   * - Hvis øvrige fraværsdage skal udgå af TAF-perioden, udelades dagene i de angivne
   *   TAF-perioder (ingen automatisk fradrag).
   */
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  const datoSet = new Set<ISODateString>();
  let antalHverdage = 0;

  let currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    const isoStr = formatToISO(currentDate);
    datoSet.add(isoStr);

    const dayOfWeek = currentDate.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      antalHverdage += 1;
    }

    currentDate = addDays(currentDate, 1);
  }

  const ferieDageSet = new Set<ISODateString>();
  for (const feriePeriode of ferieperioder) {
    if (!feriePeriode.fra || !feriePeriode.til) continue;
    if (feriePeriode.fra > feriePeriode.til) continue;

    const ferieFra = parseISODate(feriePeriode.fra);
    const ferieTil = parseISODate(feriePeriode.til);
    if (!ferieFra || !ferieTil) continue;

    let ferieCurrent = new Date(ferieFra);
    while (ferieCurrent <= ferieTil) {
      const isoStr = formatToISO(ferieCurrent);
      if (datoSet.has(isoStr)) {
        const dow = ferieCurrent.getUTCDay();
        if (dow >= 1 && dow <= 5) {
          ferieDageSet.add(isoStr);
        }
      }
      ferieCurrent = addDays(ferieCurrent, 1);
    }
  }

  let antalSHDage = 0;
  const shDageSet = new Set<ISODateString>();
  for (let year = fraDate.getUTCFullYear(); year <= tilDate.getUTCFullYear(); year += 1) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const isoStr = formatToISO(helligdag);
      const dow = helligdag.getUTCDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (erHverdag && datoSet.has(isoStr)) {
        shDageSet.add(isoStr);
      }
      if (erHverdag && datoSet.has(isoStr) && !ferieDageSet.has(isoStr)) {
        antalSHDage += 1;
      }
    }
  }

  const blockedLoseFerie = new Set<ISODateString>([...ferieDageSet, ...shDageSet]);
  const placedLoseFeriedage = new Set<ISODateString>();
  let remainingLoseFeriedage = toNonNegativeInt(loseFeriedage);
  if (remainingLoseFeriedage > 0) {
    let candidate = new Date(fraDate);
    while (candidate <= tilDate && remainingLoseFeriedage > 0) {
      const isoStr = formatToISO(candidate);
      const dow = candidate.getUTCDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (erHverdag && !blockedLoseFerie.has(isoStr)) {
        placedLoseFeriedage.add(isoStr);
        remainingLoseFeriedage -= 1;
      }
      candidate = addDays(candidate, 1);
    }
  }

  const arbejdsdageMinusSH = antalHverdage - antalSHDage;
  let fravaersdage = 0;
  switch (context.kind) {
    case 'taf':
      fravaersdage = 0;
      break;
    case 'beregningsgrundlag':
      fravaersdage = toNonNegativeInt(context.oevrigeFravaersdage);
      break;
    default:
      assertNever(context);
  }
  const loseFeriedageFradrag = placedLoseFeriedage.size;
  const tafDage = Math.max(0, arbejdsdageMinusSH - ferieDageSet.size - loseFeriedageFradrag - fravaersdage);

  return {
    arbejdsdage: antalHverdage,
    shDage: antalSHDage,
    arbejdsdageMinusSH,
    feriedage: ferieDageSet.size,
    loseFeriedage: loseFeriedageFradrag,
    oevrigeFravaersdage: fravaersdage,
    tafDage,
  };
};

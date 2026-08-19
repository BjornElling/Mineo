/**
 * TAF opreguleret til beregningsåret – afledt beregningslag
 *
 * Dette modul tager den allerede beregnede TAF fordelt på kalenderår
 * (tafPerYearDerived) og opregulerer hvert års nettobeløb til den værdi, det
 * har i beregningsårets prisniveau. Beregningsåret er årstallet for den dato,
 * opgørelsen er lavet (opgørelseLavetDen, ellers dagsdato) – kun årstallet
 * bruges, uanset dag og måned.
 *
 * PRINCIP:
 *   For hvert år Y opreguleres med den AKKUMULEREDE REGULERINGSSATS for de
 *   mellemliggende år (∏(1 + sats/100)), dvs. "tilpasningsprocenten plus to
 *   procent" – samme metode som ved fremskrivning af årsløn til EET efter EAL og
 *   ved regulering af offentlige ydelser. Selve beregningen ligger i den fælles
 *   motor `opregulerMedAkkumuleretReguleringssats`.
 *
 *   Faktoren udtrykkes som en deltaprocent (deltaPct), så PDF'en kan vise
 *   "x (100 % + d %)" på samme måde som lønudviklingssegmenterne. Den særskilte
 *   opreguleringsfaktor afrundes til fire decimaler, og det opregulerede beløb
 *   beregnes konsistent med den VISTE (afrundede) deltaPct, så visning og tal
 *   stemmer overens.
 *
 * FAIL-CLOSED:
 *   Mangler reguleringssats for et af de mellemliggende år (frem til
 *   beregningsåret) for et år med et nettobeløb forskelligt fra 0, returneres en
 *   fejl i stedet for en misvisende delvis opregulering. Snapshot-laget oversætter
 *   fejlen til en blokerende invariant.
 */

import type { ISODateString } from '../../../types/branded';
import type { MoneyOre } from '../../money/money';
import {
  addMoneyOre,
  fromKroner,
  roundKroner,
  toKroner,
  zeroMoneyOre,
} from '../../money/money';
import { roundByMethod } from '../../../utils/rounding';
import { opregulerMedAkkumuleretReguleringssats } from '../../satser/opreguleringsmotorer';
import type { TafPerYearResult } from './tafPerYearDerived';

// ─── Types ──────────────────────────────────────────────────────────────

export const TAF_OPREGULERET_DELTA_PCT_DECIMALS = 4;

export type TafOpreguleretYearEntry = Readonly<{
  year: number;
  /** Det oprindelige TAF-nettobeløb for året (før opregulering). */
  yearTafOre: MoneyOre;
  /** Opreguleringsfaktor udtrykt som deltaprocent (afrundet til fire decimaler). */
  deltaPct: number;
  /** Det opregulerede TAF-nettobeløb for året. */
  yearTafOpreguleretOre: MoneyOre;
}>;

export type TafPerYearOpreguleretResult = Readonly<{
  /** Beregningsåret, alle år er opreguleret til. */
  beregningsAar: number;
  years: readonly TafOpreguleretYearEntry[];
  /** Sum af de opregulerede årsbeløb. */
  sumOpreguleretOre: MoneyOre;
}>;

export type TafPerYearOpreguleretBuildOutcome =
  | Readonly<{ kind: 'ok'; result: TafPerYearOpreguleretResult }>
  | Readonly<{ kind: 'not_applicable' }>
  | Readonly<{
    kind: 'error';
    reason: 'manglende_reguleringssats';
    /** Mellemliggende år der mangler reguleringssats (frem til beregningsåret). */
    manglendeAar: readonly number[];
  }>;

// ─── Builder ────────────────────────────────────────────────────────────

/**
 * Opregulerer det per-år fordelte TAF-krav til beregningsårets prisniveau.
 *
 * Bruger den fælles motor `opregulerMedAkkumuleretReguleringssats` (akkumuleret
 * reguleringssats / "tilpasningsprocenten plus to procent") – samme metode som
 * fremskrivning af årsløn til EET efter EAL og regulering af offentlige ydelser.
 *
 * @param tafPerYear  Resultatet fra buildTafPerYearBuildOutcome (kind 'ok').
 * @param beregningsDatoISO  Datoen opgørelsen er lavet (kun årstallet bruges).
 */
export const buildTafPerYearOpreguleretBuildOutcome = (
  tafPerYear: TafPerYearResult | null,
  beregningsDatoISO: ISODateString
): TafPerYearOpreguleretBuildOutcome => {
  if (!tafPerYear || tafPerYear.years.length === 0) {
    return { kind: 'not_applicable' };
  }

  const beregningsAar = Number.parseInt(beregningsDatoISO.slice(0, 4), 10);
  if (!Number.isInteger(beregningsAar)) {
    return { kind: 'error', reason: 'manglende_reguleringssats', manglendeAar: [] };
  }

  // Indsaml manglende reguleringssatser: ethvert mellemliggende år (frem til
  // beregningsåret) for et år med et nettobeløb ≠ 0. År med 0-beløb påvirker ikke
  // totalen, så de behøver ikke fuld satsdækning (de vises med faktor 0).
  const manglendeAarSet = new Set<number>();
  for (const yearEntry of tafPerYear.years) {
    if (yearEntry.yearTafOre === 0) continue;
    const { manglendeAar } = opregulerMedAkkumuleretReguleringssats({
      kildeAar: yearEntry.year,
      maalAar: beregningsAar,
    });
    for (const aar of manglendeAar) manglendeAarSet.add(aar);
  }
  if (manglendeAarSet.size > 0) {
    return {
      kind: 'error',
      reason: 'manglende_reguleringssats',
      manglendeAar: [...manglendeAarSet].sort((a, b) => a - b),
    };
  }

  const years: TafOpreguleretYearEntry[] = [];
  let sumOpreguleretOre = zeroMoneyOre();

  for (const yearEntry of tafPerYear.years) {
    const opregulering = opregulerMedAkkumuleretReguleringssats({
      kildeAar: yearEntry.year,
      maalAar: beregningsAar,
    });
    // 0-beløbs-år kan have manglende satser uden at blokere (fanget ovenfor).
    // Vis dem med faktor 0 og uændret beløb.
    if (opregulering.manglendeAar.length > 0) {
      years.push({
        year: yearEntry.year,
        yearTafOre: yearEntry.yearTafOre,
        deltaPct: 0,
        yearTafOpreguleretOre: yearEntry.yearTafOre,
      });
      continue;
    }

    const deltaPct = roundByMethod(opregulering.deltaPct, TAF_OPREGULERET_DELTA_PCT_DECIMALS, 'halfAwayFromZero');
    // Beregn det opregulerede beløb konsistent med den viste deltaPct, så
    // visning og tal stemmer overens (parallelt med segmentAmountOre).
    const baseKroner = toKroner(yearEntry.yearTafOre);
    const opreguleretKroner = roundKroner(baseKroner * (1 + deltaPct / 100));
    const yearTafOpreguleretOre = fromKroner(opreguleretKroner);
    sumOpreguleretOre = addMoneyOre(sumOpreguleretOre, yearTafOpreguleretOre);

    years.push({
      year: yearEntry.year,
      yearTafOre: yearEntry.yearTafOre,
      deltaPct,
      yearTafOpreguleretOre,
    });
  }

  return {
    kind: 'ok',
    result: {
      beregningsAar,
      years,
      sumOpreguleretOre,
    },
  };
};

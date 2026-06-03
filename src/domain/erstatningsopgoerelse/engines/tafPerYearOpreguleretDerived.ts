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
 *   For hvert år Y opreguleres med faktoren idx[beregningsår] / idx[Y], hvor
 *   idx er den lovbestemte årslønsindeks-tabel (aarsloenAslMax). Det er samme
 *   indeksserie og samme fremgangsmåde som anvendes ved opregulering af årsløn,
 *   men her udtrykt som en selvstændig ydelse.
 *
 *   Faktoren udtrykkes som en deltaprocent (deltaPct), så PDF'en kan vise
 *   "x (100 % + d %)" på samme måde som lønudviklingssegmenterne. Det
 *   opregulerede beløb beregnes konsistent med deltaPct, så visning og tal
 *   stemmer overens.
 *
 * FAIL-CLOSED:
 *   Mangler indeks for beregningsåret eller for et af de relevante år (med et
 *   nettobeløb forskelligt fra 0), returneres en fejl i stedet for en
 *   misvisende delvis opregulering. Snapshot-laget oversætter fejlen til en
 *   blokerende invariant.
 */

import type { ISODateString } from '../../../types/branded';
import type { MoneyOre } from '../snapshot/eoPresentationModel';
import { roundKroner, toOre } from '../snapshot/eoPresentationModel';
import { roundByMethod } from '../../../utils/rounding';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import type { TafPerYearResult } from './tafPerYearDerived';

// ─── Types ──────────────────────────────────────────────────────────────

export type TafOpreguleretYearEntry = Readonly<{
  year: number;
  /** Det oprindelige TAF-nettobeløb for året (før opregulering). */
  yearTafOre: MoneyOre;
  /** Opreguleringsfaktor udtrykt som deltaprocent (afrundet til 2 decimaler). */
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
    reason: 'manglende_indeks';
    /** Årstal der mangler indeks (inkl. evt. beregningsåret). */
    manglendeAar: readonly number[];
  }>;

// ─── Builder ────────────────────────────────────────────────────────────

const indexForYear = (year: number): number | undefined => {
  const idx = aarsloenAslMax[year as keyof typeof aarsloenAslMax];
  return typeof idx === 'number' && Number.isFinite(idx) && idx > 0 ? idx : undefined;
};

/**
 * Opregulerer det per-år fordelte TAF-krav til beregningsårets prisniveau.
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
    return { kind: 'error', reason: 'manglende_indeks', manglendeAar: [] };
  }

  const baseIndex = indexForYear(beregningsAar);

  // Indsaml manglende år: beregningsåret samt ethvert år med et nettobeløb ≠ 0
  // hvor indeks mangler. År med 0-beløb påvirker ikke totalen, så de behøver
  // ikke indeks (men de vises stadig med faktor 0).
  const manglendeAar: number[] = [];
  if (baseIndex === undefined) {
    manglendeAar.push(beregningsAar);
  }
  for (const yearEntry of tafPerYear.years) {
    if (yearEntry.yearTafOre === 0) continue;
    if (indexForYear(yearEntry.year) === undefined) {
      manglendeAar.push(yearEntry.year);
    }
  }
  if (manglendeAar.length > 0 || baseIndex === undefined) {
    return {
      kind: 'error',
      reason: 'manglende_indeks',
      manglendeAar: [...new Set(manglendeAar)].sort((a, b) => a - b),
    };
  }

  const years: TafOpreguleretYearEntry[] = [];
  let sumOpreguleretOre = 0;

  for (const yearEntry of tafPerYear.years) {
    const yearIndex = indexForYear(yearEntry.year);
    // yearIndex kan kun være undefined her hvis yearTafOre === 0 (ellers fanget ovenfor).
    if (yearIndex === undefined) {
      years.push({
        year: yearEntry.year,
        yearTafOre: yearEntry.yearTafOre,
        deltaPct: 0,
        yearTafOpreguleretOre: yearEntry.yearTafOre,
      });
      continue;
    }

    const deltaPct = roundByMethod((baseIndex / yearIndex - 1) * 100, 2, 'halfAwayFromZero');
    // Beregn det opregulerede beløb konsistent med den viste deltaPct, så
    // visning og tal stemmer overens (parallelt med segmentAmountOre).
    const baseKroner = yearEntry.yearTafOre / 100;
    const opreguleretKroner = roundKroner(baseKroner * (1 + deltaPct / 100));
    const yearTafOpreguleretOre = toOre(opreguleretKroner);
    sumOpreguleretOre += yearTafOpreguleretOre;

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
      sumOpreguleretOre: sumOpreguleretOre as MoneyOre,
    },
  };
};

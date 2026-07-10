import type { ISODateString } from '../../types/branded';
import { iterateIsoDatesInclusive } from '../../utils/isoDateHelpers';

/**
 * Summerer månedsbrøken for det inklusive interval: hver kalenderdag tæller som
 * `1 / antal dage i den pågældende måned`.
 *
 * Kalender-iteration er nødvendig, fordi nævneren skifter ved hver månedsgrænse.
 * Funktionen grupperer pr. måned og dividerer én gang pr. måned, så hele måneder
 * giver præcise heltal i rå forbrugere. Et omvendt interval giver 0.
 */
export const sumMaanedsbroekForInterval = (
  fra: ISODateString,
  til: ISODateString
): number => {
  if (fra > til) return 0;

  const monthCounts = new Map<string, number>();
  iterateIsoDatesInclusive(fra, til, (iso) => {
    const monthKey = iso.slice(0, 7);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
  });

  let antalMaaneder = 0;
  for (const [monthKey, count] of monthCounts) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number.parseInt(yearStr ?? '', 10);
    const month = Number.parseInt(monthStr ?? '', 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;
    const dageIMaaned = new Date(Date.UTC(year, month, 0)).getUTCDate();
    antalMaaneder += count / dageIMaaned;
  }
  return antalMaaneder;
};

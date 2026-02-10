import type { ISODateString } from '../../types/branded';
import { dateToISO } from '../../types/branded';
import { isoDateToDate } from '../dates/isoDate';
import { roundHalfAwayFromZero } from '../../utils/formatUtils';

export const beregnArbejdsdageOgMaaneder = (
  fra: ISODateString,
  til: ISODateString,
  shDage: Set<ISODateString>,
  ferieDage: Set<ISODateString>
): { arbejdsdage: number; maaneder: number } => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  let arbejdsdage = 0;
  const monthCounts = new Map<string, number>();

  const current = new Date(fraDate);
  while (current <= tilDate) {
    const iso = dateToISO(current);
    if (iso) {
      const dow = current.getUTCDay();
      const erHverdag = dow >= 1 && dow <= 5;
      const erSH = shDage.has(iso);
      const erFerie = ferieDage.has(iso);

      // Arbejdsdag = hverdag OG ikke SH OG ikke ferie
      if (erHverdag && !erSH && !erFerie) {
        arbejdsdage++;
      }

      // Måneder: hver dag tæller som 1/dage-i-måneden
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  let maaneder = 0;
  for (const [monthKey, count] of monthCounts) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const dageIMaaned = new Date(Date.UTC(year, month, 0)).getUTCDate();
    maaneder += count / dageIMaaned;
  }

  const roundedMaaneder = roundHalfAwayFromZero(maaneder, 6);
  return { arbejdsdage, maaneder: roundedMaaneder };
};

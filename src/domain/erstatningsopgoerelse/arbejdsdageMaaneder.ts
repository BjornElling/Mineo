import type { ISODateString } from '../../types/branded';
import { dateToISO } from '../../types/branded';
import { isoDateToDate } from '../dates/isoDate';

export const beregnArbejdsdageOgMaaneder = (
  fra: ISODateString,
  til: ISODateString,
  shDage: Set<ISODateString>,
  ferieDage: Set<ISODateString>
): { arbejdsdage: number; maaneder: number } => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  let arbejdsdage = 0;
  let maaneder = 0;

  const current = new Date(fraDate);
  while (current <= tilDate) {
    const iso = dateToISO(current);
    if (iso) {
      const dow = current.getDay();
      const erHverdag = dow >= 1 && dow <= 5;
      const erSH = shDage.has(iso);
      const erFerie = ferieDage.has(iso);

      // Arbejdsdag = hverdag OG ikke SH OG ikke ferie
      if (erHverdag && !erSH && !erFerie) {
        arbejdsdage++;
      }

      // Måneder: hver dag tæller som 1/dage-i-måneden
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const dageIMaaned = new Date(year, month, 0).getDate();
      maaneder += 1 / dageIMaaned;
    }

    current.setDate(current.getDate() + 1);
  }

  const roundedMaaneder = Math.round(maaneder * 1_000_000) / 1_000_000;
  return { arbejdsdage, maaneder: roundedMaaneder };
};

import type { ISODateString } from '../../types/branded';
import { dateToISO } from '../../types/branded';
import { isoDateToDate } from '../dates/isoDate';
import { optaelMaanederPraecis } from './periodiseringsMotor';

export const beregnArbejdsdageOgMaaneder = (
  fra: ISODateString,
  til: ISODateString,
  shDage: Set<ISODateString>,
  ferieDage: Set<ISODateString>
): { arbejdsdage: number; maaneder: number } => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  let arbejdsdage = 0;

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
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  const maaneder = optaelMaanederPraecis({ fra, til, oevrigeFravaersdage: 0 }) ?? 0;
  return { arbejdsdage, maaneder };
};

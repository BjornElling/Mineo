import type { ISODateString } from '../../../types/branded';
import { beregnSHDage } from '../../dates/shDageBeregning';
import { isoDateToDate } from '../../dates/isoDate';
import { iterateDatesInclusive } from '../../../utils/isoDateHelpers';

export const calculateFerieHverdageMinusSHDage = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): number | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  let hverdage = 0;
  iterateDatesInclusive(fraDate, tilDate, (date) => {
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      hverdage += 1;
    }
  });

  const shDage = beregnSHDage(fraDate, tilDate);
  return Math.max(0, hverdage - shDage);
};


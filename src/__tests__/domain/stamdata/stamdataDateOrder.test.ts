import {
  resolveStamdataDateOrder,
  STAMDATA_DATE_ORDER_ERROR_MESSAGE,
} from '../../../domain/stamdata/stamdataDateOrder';
import { toISODateString } from '../../../types/branded';

describe('resolveStamdataDateOrder', () => {
  it('udleder gensidige bounds og issues på begge felter ved omvendt datofølge', () => {
    const result = resolveStamdataDateOrder({
      skadelidteFodselsdato: toISODateString('2010-01-01'),
      skadedato: toISODateString('2009-12-31'),
    });

    expect(result.skadedatoMin).toBe(toISODateString('2010-01-01'));
    expect(result.skadelidteFodselsdatoMax).toBe(toISODateString('2009-12-31'));
    expect(result.issues).toEqual([
      { field: 'skadedato', message: STAMDATA_DATE_ORDER_ERROR_MESSAGE },
      { field: 'skadelidteFodselsdato', message: STAMDATA_DATE_ORDER_ERROR_MESSAGE },
    ]);
  });

  it('udleder bounds uden issue ved gyldig eller ufuldstændig datofølge', () => {
    expect(resolveStamdataDateOrder({
      skadelidteFodselsdato: toISODateString('1990-01-01'),
      skadedato: toISODateString('2020-01-01'),
    }).issues).toEqual([]);
    expect(resolveStamdataDateOrder({
      skadelidteFodselsdato: undefined,
      skadedato: toISODateString('2020-01-01'),
    }).issues).toEqual([]);
  });
});

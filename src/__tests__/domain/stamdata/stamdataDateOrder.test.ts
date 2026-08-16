import {
  resolveStamdataDateOrder,
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
      { field: 'skadedato', message: 'Der er angivet en skadedato før skadelidtes fødselsdato (01-01-2010)' },
      { field: 'skadelidteFodselsdato', message: 'Fødselsdatoen ligger efter den angivne skadedato (31-12-2009)' },
    ]);
  });

  it('navngiver anmeldelsesdatoen og holder beskeden på det berørte felt', () => {
    const result = resolveStamdataDateOrder({
      skadelidteFodselsdato: toISODateString('2021-06-01'),
      skadedato: toISODateString('2020-06-01'),
      skadestype: 'Erhvervssygdom',
    });

    expect(result.issues).toEqual([
      { field: 'skadedato', message: 'Der er angivet en anmeldelsesdato før skadelidtes fødselsdato (01-06-2021)' },
      { field: 'skadelidteFodselsdato', message: 'Fødselsdatoen ligger efter den angivne anmeldelsesdato (01-06-2020)' },
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

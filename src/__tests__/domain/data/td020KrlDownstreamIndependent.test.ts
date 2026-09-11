import { krlForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/krlForm';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

describe('TD-020 – KRL-data som uafhængig downstream-facit', () => {
  it('fører SHK-regioners statiske endepunkter gennem KRL-formen', () => {
    const resultat = krlForm.byggResultat({
      strategi: 'krl',
      label: 'SHK (regioner)',
      reguleringsdato: iso('2018-10-01'),
      krlSatstabelId: 'SHK (regioner)',
      tafRanges: [{ fra: iso('2018-10-01'), til: iso('2020-03-31') }],
    });

    expect(resultat.segmenter.map(({ fra, til, deltaPct }) => ({ fra, til, deltaPct }))).toEqual([
      { fra: iso('2018-10-01'), til: iso('2019-03-31'), deltaPct: 0 },
      { fra: iso('2019-04-01'), til: iso('2019-09-30'), deltaPct: 0 },
      { fra: iso('2019-10-01'), til: iso('2019-12-31'), deltaPct: 0.77 },
      { fra: iso('2020-01-01'), til: iso('2020-03-31'), deltaPct: 2.43 },
    ]);
  });
});

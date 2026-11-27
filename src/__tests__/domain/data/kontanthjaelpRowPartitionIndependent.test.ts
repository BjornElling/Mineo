import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { collectIncomeDays } from '../../../domain/erstatningsopgoerelse/engines/eoIndkomstDagsgrundlag';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-08-29');
  values.vedroererPeriodeTil = iso('2024-09-02');
  values.offentligeYdelserRows = [
    {
      id: 'kontanthjaelp-foerste-partition',
      fraDato: iso('2024-08-29'),
      tilDato: iso('2024-08-30'),
      ydelsestype: 'kontanthjaelp',
      ydelse: amount(420),
      tillaeg: undefined,
    },
    {
      id: 'kontanthjaelp-anden-partition',
      fraDato: iso('2024-08-31'),
      tilDato: iso('2024-09-02'),
      ydelsestype: 'kontanthjaelp',
      ydelse: amount(1260),
      tillaeg: undefined,
    },
  ];
  return values;
};

describe('flere kontanthjælpsrækker i samme EO-kolonne', () => {
  it('bevarer to ikke-overlappende rækkepartitioner med hver sin kalenderdagssats', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('kontanthjaelp')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-08-29'),
      iso('2024-08-30'),
      iso('2024-08-31'),
      iso('2024-09-01'),
      iso('2024-09-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([210, 210, 420, 420, 420]);
    expect(income.benefits).toEqual([{ typeKey: 'kontanthjaelp', label: 'Kontanthjælp', amount: 1680 }]);
  });
});

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
  values.vedroererPeriodeFra = iso('2024-06-28');
  values.vedroererPeriodeTil = iso('2024-07-01');
  values.offentligeYdelserRows = [
    {
      id: 'efterloen-foerste-partition',
      fraDato: iso('2024-06-28'),
      tilDato: iso('2024-06-29'),
      ydelsestype: 'efterloen',
      ydelse: amount(400),
      tillaeg: amount(100),
    },
    {
      id: 'efterloen-anden-partition',
      fraDato: iso('2024-06-30'),
      tilDato: iso('2024-07-01'),
      ydelsestype: 'efterloen',
      ydelse: amount(900),
      tillaeg: amount(300),
    },
  ];
  return values;
};

describe('flere efterlønsrækker i samme EO-kolonne', () => {
  it('bevarer to ikke-overlappende kalenderdagspartitioner med tillæg', () => {
    const { receiver, days } = collectIncomeDays();
    const income = buildIncomeForRanges(buildValues(), [{ fra: iso('2024-06-28'), til: iso('2024-07-01') }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('efterloen')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-06-28'),
      iso('2024-06-29'),
      iso('2024-06-30'),
      iso('2024-07-01'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([250, 250, 600, 600]);
    expect(income.benefits).toEqual([{ typeKey: 'efterloen', label: 'Efterløn', amount: 1700 }]);
  });
});

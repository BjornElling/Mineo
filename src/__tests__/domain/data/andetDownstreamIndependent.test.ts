import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { collectIncomeDays } from '../../../domain/erstatningsopgoerelse/engines/eoIndkomstDagsgrundlag';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-02-28');
  values.vedroererPeriodeTil = iso('2024-03-02');
  values.offentligeYdelserRows = [{
    id: 'andet-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'andet',
    ydelse: amount(1000),
    tillaeg: amount(200),
  }];
  return values;
};

describe('Andet som EO-downstream-consumer', () => {
  it('fordeler Andet på kalenderdage inklusive skuddag og weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const income = buildIncomeForRanges(buildValues(), [{ fra: iso('2024-02-28'), til: iso('2024-03-02') }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('andet')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([300, 300, 300, 300]);
    expect(income.benefits).toEqual([{ typeKey: 'andet', label: 'Andet', amount: 1200 }]);
  });
});

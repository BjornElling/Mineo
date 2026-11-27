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
  values.vedroererPeriodeFra = iso('2024-05-31');
  values.vedroererPeriodeTil = iso('2024-06-03');
  values.offentligeYdelserRows = [{
    id: 'dagpenge-kalenderdage',
    fraDato: iso('2024-05-31'),
    tilDato: iso('2024-06-03'),
    ydelsestype: 'dagpenge',
    ydelse: amount(1000),
    tillaeg: amount(200),
  }];
  return values;
};

describe('dagpenge som EO-downstream-consumer', () => {
  it('fordeler dagpenge på kalenderdage omkring en weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const income = buildIncomeForRanges(buildValues(), [{ fra: iso('2024-05-31'), til: iso('2024-06-03') }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('dagpenge')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
      iso('2024-06-03'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([300, 300, 300, 300]);
    expect(income.benefits).toEqual([{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 1200 }]);
  });
});

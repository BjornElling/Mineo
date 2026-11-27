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
  values.vedroererPeriodeFra = iso('2024-05-18');
  values.vedroererPeriodeTil = iso('2024-05-20');
  values.offentligeYdelserRows = [{
    id: 'pension-pinse-facit',
    fraDato: iso('2024-05-18'),
    tilDato: iso('2024-05-20'),
    ydelsestype: 'pension',
    ydelse: amount(900),
    tillaeg: amount(300),
  }];
  return values;
};

describe('pension som EO-downstream-consumer', () => {
  it('fordeler pension på kalenderdage omkring en weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('pension')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [iso('2024-05-18'), iso('2024-05-19'), iso('2024-05-20')];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([400, 400, 400]);
    expect(income.benefits).toEqual([{ typeKey: 'pension', label: 'Pension', amount: 1200 }]);
  });
});

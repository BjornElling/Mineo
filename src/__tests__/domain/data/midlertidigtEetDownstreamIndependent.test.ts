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
  values.vedroererPeriodeFra = iso('2024-02-28');
  values.vedroererPeriodeTil = iso('2024-03-01');
  values.offentligeYdelserRows = [{
    id: 'midlertidigt-eet-skuddag',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-01'),
    ydelsestype: 'midlertidigt_eet',
    ydelse: amount(900),
    tillaeg: amount(300),
  }];
  return values;
};

describe('midlertidigt EET som EO-downstream-consumer', () => {
  it('fordeler kalenderdagsydelsen inklusive skuddag', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('midlertidigt_eet')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([400, 400, 400]);
    expect(income.benefits).toEqual([{ typeKey: 'midlertidigt_eet', label: 'Midlertidigt EET', amount: 1200 }]);
  });
});

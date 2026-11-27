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
  const fra = iso('2024-12-30');
  const til = iso('2025-01-02');

  values.vedroererPeriodeFra = fra;
  values.vedroererPeriodeTil = til;
  values.offentligeYdelserRows = [{
    id: 'foertidspension-aarsskifte',
    fraDato: fra,
    tilDato: til,
    ydelsestype: 'foertidspension',
    ydelse: amount(3200),
    tillaeg: undefined,
  }];
  return values;
};

describe('førtidspension som EO-downstream-consumer', () => {
  it('fordeler kalenderdagsydelsen over årsskifte og nytårsdag', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('foertidspension')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-12-30'),
      iso('2024-12-31'),
      iso('2025-01-01'),
      iso('2025-01-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([800, 800, 800, 800]);
    expect(income.benefits).toEqual([{ typeKey: 'foertidspension', label: 'Førtidspension', amount: 3200 }]);
  });
});

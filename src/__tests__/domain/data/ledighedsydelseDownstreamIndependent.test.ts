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
  values.vedroererPeriodeFra = iso('2024-01-05');
  values.vedroererPeriodeTil = iso('2024-01-08');
  values.offentligeYdelserRows = [{
    id: 'ledighedsydelse-kalenderdage',
    fraDato: iso('2024-01-05'),
    tilDato: iso('2024-01-08'),
    ydelsestype: 'ledighedsydelse',
    ydelse: amount(1200),
    tillaeg: undefined,
  }];
  return values;
};

describe('ledighedsydelseDownstreamIndependent', () => {
  it('fører ledighedsydelse fra registret gennem beregningens kalenderdagsconsumer', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('ledighedsydelse')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-01-05'),
      iso('2024-01-06'),
      iso('2024-01-07'),
      iso('2024-01-08'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([300, 300, 300, 300]);
    expect(income.benefits).toEqual([{ typeKey: 'ledighedsydelse', label: 'Ledighedsydelse', amount: 1200 }]);
  });
});

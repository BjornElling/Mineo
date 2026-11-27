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
  values.vedroererPeriodeFra = iso('2024-05-30');
  values.vedroererPeriodeTil = iso('2024-06-02');
  values.offentligeYdelserRows = [{
    id: 'su-kalenderdage',
    fraDato: iso('2024-05-30'),
    tilDato: iso('2024-06-02'),
    ydelsestype: 'su',
    ydelse: amount(900),
    tillaeg: amount(300),
  }];
  return values;
};

describe('SU som EO-downstream-consumer', () => {
  it('fordeler SU på kalenderdage over månedsgrænse og weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('su')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-05-30'),
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([300, 300, 300, 300]);
    expect(income.benefits).toEqual([{ typeKey: 'su', label: 'SU', amount: 1200 }]);
  });
});

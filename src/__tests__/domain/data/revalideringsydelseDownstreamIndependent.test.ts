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
    id: 'revalideringsydelse-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'revalideringsydelse',
    ydelse: amount(1600),
    tillaeg: amount(400),
  }];
  return values;
};

describe('revalideringsydelse som EO-downstream-consumer', () => {
  it('fordeler samlet ydelse på alle kalenderdage inkl. skuddag og weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('revalideringsydelse')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([500, 500, 500, 500]);
    expect(income.benefits).toEqual([{ typeKey: 'revalideringsydelse', label: 'Revalideringsydelse', amount: 2000 }]);
  });
});

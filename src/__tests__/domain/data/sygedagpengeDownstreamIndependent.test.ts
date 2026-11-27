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
  values.vedroererPeriodeFra = iso('2024-12-23');
  values.vedroererPeriodeTil = iso('2024-12-27');
  values.offentligeYdelserRows = [{
    id: 'sygedagpenge-sh-facit',
    fraDato: iso('2024-12-23'),
    tilDato: iso('2024-12-27'),
    ydelsestype: 'sygedagpenge',
    ydelse: amount(3000),
    tillaeg: undefined,
  }];
  return values;
};

describe('sygedagpenge som downstream-consumer', () => {
  it('fordeler beløbet på hverdage efter helligdagsfradraget', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('sygedagpenge')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-12-23'),
      iso('2024-12-24'),
      iso('2024-12-25'),
      iso('2024-12-26'),
      iso('2024-12-27'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([1000, 1000, 0, 0, 1000]);
    expect(income.benefits.map((entry) => [entry.typeKey, entry.amount])).toEqual([['sygedagpenge', 3000]]);
  });
});

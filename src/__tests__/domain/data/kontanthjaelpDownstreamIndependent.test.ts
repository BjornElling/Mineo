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
    id: 'kontanthjaelp-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'kontanthjaelp',
    ydelse: amount(1000),
    tillaeg: undefined,
  }];
  return values;
};

describe('kontanthjaelpDownstreamIndependent', () => {
  it('fører kontanthjælp gennem kalenderdagsconsumeren over skuddag og weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('kontanthjaelp')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([250, 250, 250, 250]);
    expect(income.benefits.map((entry) => [entry.typeKey, entry.amount])).toEqual([['kontanthjaelp', 1000]]);
  });
});

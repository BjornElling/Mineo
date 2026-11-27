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
    id: 'ressourceforloebsydelse-kalenderdage',
    fraDato: iso('2024-05-30'),
    tilDato: iso('2024-06-02'),
    ydelsestype: 'ressourceforloebsydelse',
    ydelse: amount(2200),
    tillaeg: amount(600),
  }];
  return values;
};

describe('ressourceforløbsydelse som EO-downstream-consumer', () => {
  it('fordeler samlet ydelse på kalenderdage over månedsgrænse og weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('ressourceforloebsydelse')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-05-30'),
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([700, 700, 700, 700]);
    expect(income.benefits.map((entry) => [entry.typeKey, entry.amount])).toEqual([['ressourceforloebsydelse', 2800]]);
  });
});

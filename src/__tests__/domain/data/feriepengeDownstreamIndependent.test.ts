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
  values.vedroererPeriodeFra = iso('2024-03-27');
  values.vedroererPeriodeTil = iso('2024-04-02');
  values.offentligeYdelserRows = [{
    id: 'feriepenge-arbejdsdage',
    fraDato: iso('2024-03-27'),
    tilDato: iso('2024-04-02'),
    ydelsestype: 'feriepenge',
    ydelse: amount(600),
    tillaeg: amount(200),
  }];
  return values;
};

describe('feriepenge som EO-downstream-consumer', () => {
  it('fordeler feriepenge på arbejdsdage og springer weekend og helligdage over', () => {
    const { receiver, days } = collectIncomeDays();
    const income = buildIncomeForRanges(buildValues(), [{ fra: iso('2024-03-27'), til: iso('2024-04-02') }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('feriepenge')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [
      iso('2024-03-27'),
      iso('2024-03-28'),
      iso('2024-03-29'),
      iso('2024-03-30'),
      iso('2024-03-31'),
      iso('2024-04-01'),
      iso('2024-04-02'),
    ];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([400, 0, 0, 0, 0, 0, 400]);
    expect(income.benefits).toEqual([{ typeKey: 'feriepenge', label: 'Feriepenge', amount: 800 }]);
  });
});

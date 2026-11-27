import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { collectIncomeDays } from '../../../domain/erstatningsopgoerelse/engines/eoIndkomstDagsgrundlag';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const fra = iso('2024-07-06');
  const til = iso('2024-07-07');
  const row: OffentligeYdelserRow = {
    id: 'flextilskud-ren-weekend',
    fraDato: fra,
    tilDato: til,
    ydelse: amount(700),
    tillaeg: amount(200),
    ydelsestype: 'flextilskud',
  };

  values.vedroererPeriodeFra = fra;
  values.vedroererPeriodeTil = til;
  values.offentligeYdelserRows = [row];
  return values;
};

describe('flextilskud som EO-downstream-consumer', () => {
  it('fordeler kalenderdagsydelsen på en ren weekend', () => {
    const { receiver, days } = collectIncomeDays();
    const values = buildValues();
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) throw new Error('Testperioden mangler');
    const income = buildIncomeForRanges(values, [{ fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }],
      undefined, undefined, undefined, receiver);
    const amounts = new Map(days.ydelse.get('flextilskud')?.map(({ date, amount }) => [date, amount]));
    const relevantDates = [iso('2024-07-06'), iso('2024-07-07')];
    expect(relevantDates.map((date) => amounts.get(date) ?? 0)).toEqual([450, 450]);
    expect(income.benefits).toEqual([{ typeKey: 'flextilskud', label: 'Flextilskud', amount: 900 }]);
  });
});

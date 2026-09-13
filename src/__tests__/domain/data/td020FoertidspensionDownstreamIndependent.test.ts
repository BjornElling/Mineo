import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
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

describe('DATA-001/CALC-006/TD-020 – førtidspension som EO-downstream-consumer', () => {
  it('fordeler kalenderdagsydelsen over årsskifte og nytårsdag med kontrolsum', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:foertidspension');
    const relevantDates = [
      iso('2024-12-30'),
      iso('2024-12-31'),
      iso('2025-01-01'),
      iso('2025-01-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:foertidspension')?.header)
      .toBe('Førtidspension');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // Førtidspension er kalenderdagsbaseret: 3.200 kr. / 4 kalenderdage = 800 kr. pr. dag.
    // Nytårsdag er en helligdag, men skal stadig have samme beløb som de øvrige kalenderdage.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([800, 800, 800, 800]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:foertidspension'))).toEqual([
      '800,00',
      '800,00',
      '800,00',
      '800,00',
    ]);
    expect(model.tableData.isSognehelligdagByIndex[relevantIndexes[2]]).toBe(true);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(3200);
    expect(model.integrityIssues).toEqual([]);
  });
});

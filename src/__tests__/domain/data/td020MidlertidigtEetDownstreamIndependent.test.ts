import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-02-28');
  values.vedroererPeriodeTil = iso('2024-03-01');
  values.offentligeYdelserRows = [{
    id: 'midlertidigt-eet-skuddag',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-01'),
    ydelsestype: 'midlertidigt_eet',
    ydelse: amount(900),
    tillaeg: amount(300),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – midlertidigt EET som EO-downstream-consumer', () => {
  it('fordeler kalenderdagsydelsen inklusive skuddag med formattering og kontrolsum', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:midlertidigt_eet');
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:midlertidigt_eet')?.header)
      .toBe('Midlertidigt EET');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 28. februar–1. marts er tre kalenderdage, fordi 2024 er et skudår.
    // 900 kr. + 300 kr. = 1.200 kr., så facit er 400 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([400, 400, 400]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:midlertidigt_eet'))).toEqual([
      '400,00',
      '400,00',
      '400,00',
    ]);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[1]]).toBe(true);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

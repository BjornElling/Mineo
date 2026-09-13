import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-05-18');
  values.vedroererPeriodeTil = iso('2024-05-20');
  values.offentligeYdelserRows = [{
    id: 'pension-pinse-facit',
    fraDato: iso('2024-05-18'),
    tilDato: iso('2024-05-20'),
    ydelsestype: 'pension',
    ydelse: amount(900),
    tillaeg: amount(300),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – pension som EO-downstream-consumer', () => {
  it('fordeler pension på kalenderdage omkring en weekend med intakt kontrolsum', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:pension');
    const relevantDates = [iso('2024-05-18'), iso('2024-05-19'), iso('2024-05-20')];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:pension')?.header).toBe('Pension');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 18.–20. maj 2024 er tre kalenderdage. 900 kr. + 300 kr. = 1.200 kr.,
    // så det håndberegnede facit er 1.200 kr. / 3 = 400 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([400, 400, 400]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:pension'))).toEqual([
      '400,00',
      '400,00',
      '400,00',
    ]);
    expect(relevantIndexes.slice(0, 2).map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      false,
      false,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

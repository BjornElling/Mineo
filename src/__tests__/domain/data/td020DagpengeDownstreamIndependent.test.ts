import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-05-31');
  values.vedroererPeriodeTil = iso('2024-06-03');
  values.offentligeYdelserRows = [{
    id: 'dagpenge-kalenderdage',
    fraDato: iso('2024-05-31'),
    tilDato: iso('2024-06-03'),
    ydelsestype: 'dagpenge',
    ydelse: amount(1000),
    tillaeg: amount(200),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – dagpenge som EO-downstream-consumer', () => {
  it('fordeler dagpenge på kalenderdage omkring en weekend med kontrolsum', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:dagpenge');
    const relevantDates = [
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
      iso('2024-06-03'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:dagpenge')?.header).toBe('Dagpenge');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 31. maj–3. juni er fire kalenderdage. 1.000 kr. + 200 kr. = 1.200 kr.,
    // så det håndberegnede facit er 1.200 kr. / 4 = 300 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([300, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:dagpenge'))).toEqual([
      '300,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

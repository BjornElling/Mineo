import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
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
    id: 'andet-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'andet',
    ydelse: amount(1000),
    tillaeg: amount(200),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – Andet som EO-downstream-consumer', () => {
  it('fordeler Andet på kalenderdage inklusive skuddag og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:andet');
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:andet')?.header).toBe('Andet');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 28. februar–2. marts er fire kalenderdage. 1.000 kr. + 200 kr. = 1.200 kr.,
    // så det håndberegnede facit er 1.200 kr. / 4 = 300 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([300, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:andet'))).toEqual([
      '300,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

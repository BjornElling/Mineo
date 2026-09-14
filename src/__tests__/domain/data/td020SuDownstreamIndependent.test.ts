import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
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
    id: 'su-kalenderdage',
    fraDato: iso('2024-05-30'),
    tilDato: iso('2024-06-02'),
    ydelsestype: 'su',
    ydelse: amount(900),
    tillaeg: amount(300),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – SU som EO-downstream-consumer', () => {
  it('fordeler SU på kalenderdage over månedsgrænse og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:su');
    const relevantDates = [
      iso('2024-05-30'),
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:su')?.header).toBe('SU');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 30. maj–2. juni er fire kalenderdage. 900 kr. + 300 kr. = 1.200 kr.,
    // så det håndberegnede facit er 1.200 kr. / 4 = 300 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([300, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:su'))).toEqual([
      '300,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

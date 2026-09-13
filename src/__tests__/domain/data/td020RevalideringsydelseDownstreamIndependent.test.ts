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
    id: 'revalideringsydelse-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'revalideringsydelse',
    ydelse: amount(1600),
    tillaeg: amount(400),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – revalideringsydelse som EO-downstream-consumer', () => {
  it('fordeler samlet ydelse på alle kalenderdage inkl. skuddag og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:revalideringsydelse');
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));
    const column = model.columns.find((candidate) => candidate.id === 'offentlig:revalideringsydelse');

    expect(column?.header).toBe('Revaliderings-\nydelse');
    expect(amounts).toBeDefined();
    expect(relevantIndexes).toEqual([27, 28, 29, 30]);
    if (!amounts) return;

    // Revalideringsydelse er kalenderdagsbaseret: (1.600 kr. + 400 kr.) / 4 kalenderdage = 500 kr. pr. dag.
    // Skuddagen og lørdagen skal derfor have samme beløb som de øvrige dage.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([500, 500, 500, 500]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:revalideringsydelse'))).toEqual([
      '500,00',
      '500,00',
      '500,00',
      '500,00',
    ]);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[3]]).toBe(false);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(2000);
    expect(model.integrityIssues).toEqual([]);
  });
});

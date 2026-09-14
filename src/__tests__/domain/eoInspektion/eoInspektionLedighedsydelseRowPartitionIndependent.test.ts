import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-07-31');
  values.vedroererPeriodeTil = iso('2024-08-04');
  values.offentligeYdelserRows = [
    {
      id: 'ledighedsydelse-foerste-partition',
      fraDato: iso('2024-07-31'),
      tilDato: iso('2024-08-01'),
      ydelsestype: 'ledighedsydelse',
      ydelse: amount(400),
      tillaeg: amount(100),
    },
    {
      id: 'ledighedsydelse-anden-partition',
      fraDato: iso('2024-08-02'),
      tilDato: iso('2024-08-04'),
      ydelsestype: 'ledighedsydelse',
      ydelse: amount(700),
      tillaeg: amount(200),
    },
  ];
  return values;
};

describe('CALC-006 / TD-020 – flere ledighedsydelsesrækker i EO-inspektionen', () => {
  it('bevarer hver kalenderdagspartition over månedsskifte og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:ledighedsydelse');
    const relevantDates = [
      iso('2024-07-31'),
      iso('2024-08-01'),
      iso('2024-08-02'),
      iso('2024-08-03'),
      iso('2024-08-04'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:ledighedsydelse')?.header)
      .toBe('Ledigheds-\nydelse');
    expect(model.tableData.dates).toHaveLength(62);
    expect(amounts).toBeDefined();
    expect(relevantIndexes).toEqual([30, 31, 32, 33, 34]);
    if (!amounts) return;

    // Første række giver (400 + 100) / 2 = 250 kr. pr. kalenderdag.
    // Anden række giver (700 + 200) / 3 = 300 kr. pr. kalenderdag.
    // Månedsskiftet og weekenden må ikke blande de to række-partitioner.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([250, 250, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:ledighedsydelse'))).toEqual([
      '250,00',
      '250,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1400);
    expect(model.integrityIssues).toEqual([]);
  });
});

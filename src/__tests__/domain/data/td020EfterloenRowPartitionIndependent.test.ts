import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-06-28');
  values.vedroererPeriodeTil = iso('2024-07-01');
  values.offentligeYdelserRows = [
    {
      id: 'efterloen-foerste-partition',
      fraDato: iso('2024-06-28'),
      tilDato: iso('2024-06-29'),
      ydelsestype: 'efterloen',
      ydelse: amount(400),
      tillaeg: amount(100),
    },
    {
      id: 'efterloen-anden-partition',
      fraDato: iso('2024-06-30'),
      tilDato: iso('2024-07-01'),
      ydelsestype: 'efterloen',
      ydelse: amount(900),
      tillaeg: amount(300),
    },
  ];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – flere efterlønsrækker i samme EO-kolonne', () => {
  it('bevarer to ikke-overlappende kalenderdagspartitioner med tillæg og kontrolsum', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:efterloen');
    const relevantDates = [
      iso('2024-06-28'),
      iso('2024-06-29'),
      iso('2024-06-30'),
      iso('2024-07-01'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:efterloen')?.header).toBe('Efterløn');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // Første række giver (400 + 100) / 2 = 250 kr. pr. dag.
    // Anden række giver (900 + 300) / 2 = 600 kr. pr. dag.
    // Månedsskiftet og weekenden må ikke blande de to kalenderdagspartitioner.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([250, 250, 600, 600]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:efterloen'))).toEqual([
      '250,00',
      '250,00',
      '600,00',
      '600,00',
    ]);
    expect(relevantIndexes.slice(1, 3).map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      false,
      false,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1700);
    expect(model.integrityIssues).toEqual([]);
  });
});

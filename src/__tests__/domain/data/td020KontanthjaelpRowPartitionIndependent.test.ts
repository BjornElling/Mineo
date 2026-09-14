import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-08-29');
  values.vedroererPeriodeTil = iso('2024-09-02');
  values.offentligeYdelserRows = [
    {
      id: 'kontanthjaelp-foerste-partition',
      fraDato: iso('2024-08-29'),
      tilDato: iso('2024-08-30'),
      ydelsestype: 'kontanthjaelp',
      ydelse: amount(420),
      tillaeg: undefined,
    },
    {
      id: 'kontanthjaelp-anden-partition',
      fraDato: iso('2024-08-31'),
      tilDato: iso('2024-09-02'),
      ydelsestype: 'kontanthjaelp',
      ydelse: amount(1260),
      tillaeg: undefined,
    },
  ];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – flere kontanthjælpsrækker i samme EO-kolonne', () => {
  it('bevarer to ikke-overlappende rækkepartitioner med hver sin kalenderdagssats', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:kontanthjaelp');
    const relevantDates = [
      iso('2024-08-29'),
      iso('2024-08-30'),
      iso('2024-08-31'),
      iso('2024-09-01'),
      iso('2024-09-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:kontanthjaelp')?.header)
      .toBe('Kontanthjælp');
    expect(amounts).toBeDefined();
    expect(relevantIndexes).toEqual([28, 29, 30, 31, 32]);
    if (!amounts) return;

    // Første række giver 420 kr. / 2 dage = 210 kr. pr. dag.
    // Anden række giver 1.260 kr. / 3 dage = 420 kr. pr. dag.
    // Månedsskiftet og weekenden skal derfor ikke ændre rækkernes dagssatser.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([210, 210, 420, 420, 420]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:kontanthjaelp'))).toEqual([
      '210,00',
      '210,00',
      '420,00',
      '420,00',
      '420,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1680);
    expect(model.integrityIssues).toEqual([]);
  });
});

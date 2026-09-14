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
  values.vedroererPeriodeTil = iso('2024-06-03');
  values.offentligeYdelserRows = [
    {
      id: 'dagpenge-foerste-partition',
      fraDato: iso('2024-05-30'),
      tilDato: iso('2024-05-31'),
      ydelsestype: 'dagpenge',
      ydelse: amount(500),
      tillaeg: undefined,
    },
    {
      id: 'dagpenge-anden-partition',
      fraDato: iso('2024-06-01'),
      tilDato: iso('2024-06-03'),
      ydelsestype: 'dagpenge',
      ydelse: amount(900),
      tillaeg: undefined,
    },
  ];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – flere dagpengerrækker i samme EO-kolonne', () => {
  it('summerer to ikke-overlappende rækkepartitioner med hver sin dagssats', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:dagpenge');
    const relevantDates = [
      iso('2024-05-30'),
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
      iso('2024-06-03'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:dagpenge')?.header).toBe('Dagpenge');
    expect(amounts).toBeDefined();
    expect(relevantIndexes).toEqual([29, 30, 31, 32, 33]);
    if (!amounts) return;

    // Første række giver 500 kr. / 2 dage = 250 kr. pr. dag.
    // Anden række giver 900 kr. / 3 dage = 300 kr. pr. dag.
    // Den samlede kontrolkolonne skal derfor bevare rækkernes skift i dagssats.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([250, 250, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:dagpenge'))).toEqual([
      '250,00',
      '250,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1400);
    expect(model.integrityIssues).toEqual([]);
  });
});

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
  values.offentligeYdelserRows = [
    {
      id: 'su-foerste-partition',
      fraDato: iso('2024-02-28'),
      tilDato: iso('2024-02-29'),
      ydelsestype: 'su',
      ydelse: amount(600),
      tillaeg: undefined,
    },
    {
      id: 'su-anden-partition',
      fraDato: iso('2024-03-01'),
      tilDato: iso('2024-03-02'),
      ydelsestype: 'su',
      ydelse: amount(900),
      tillaeg: undefined,
    },
  ];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – flere SU-rækker i samme EO-kolonne', () => {
  it('bevarer to ikke-overlappende rækkepartitioner med hver sin kalenderdagssats', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:su');
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:su')?.header).toBe('SU');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // Første række giver 600 kr. / 2 kalenderdage = 300 kr. pr. dag.
    // Anden række giver 900 kr. / 2 kalenderdage = 450 kr. pr. dag.
    // Skuddagen skal forblive i første partition, og rækkeskiftet skal bevares i fælleskolonnen.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([300, 300, 450, 450]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:su'))).toEqual([
      '300,00',
      '300,00',
      '450,00',
      '450,00',
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1500);
    expect(model.integrityIssues).toEqual([]);
  });
});

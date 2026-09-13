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
    id: 'kontanthjaelp-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'kontanthjaelp',
    ydelse: amount(1000),
    tillaeg: undefined,
  }];
  return values;
};

describe('td020KontanthjaelpDownstreamIndependent', () => {
  it('fører kontanthjælp gennem kalenderdagsconsumeren over skuddag og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:kontanthjaelp');
    const relevantDates = [
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
      iso('2024-03-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(amounts).toBeDefined();
    expect(relevantIndexes).toEqual([27, 28, 29, 30]);
    if (!amounts) return;

    // Kontanthjælp er kalenderdagsbaseret: 1.000 kr. / 4 kalenderdage = 250 kr. pr. dag.
    // Skuddagen og lørdagen skal derfor have samme beløb som de øvrige dage.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([250, 250, 250, 250]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:kontanthjaelp'))).toEqual([
      '250,00',
      '250,00',
      '250,00',
      '250,00',
    ]);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[3]]).toBe(false);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1000);
    expect(model.integrityIssues).toEqual([]);
  });
});

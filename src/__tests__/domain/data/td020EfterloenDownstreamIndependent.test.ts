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
    id: 'efterloen-kalenderdage',
    fraDato: iso('2024-02-28'),
    tilDato: iso('2024-03-02'),
    ydelsestype: 'efterloen',
    ydelse: amount(1200),
    tillaeg: undefined,
  }];
  return values;
};

describe('td020EfterloenDownstreamIndependent', () => {
  it('fører efterløn gennem kalenderdagsconsumeren over skuddag og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:efterloen');
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

    // Efterløn er kalenderdagsbaseret: 1.200 kr. / 4 kalenderdage = 300 kr. pr. dag.
    // Skuddagen og lørdagen skal derfor have samme beløb som de øvrige dage.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([300, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:efterloen'))).toEqual([
      '300,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[3]]).toBe(false);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

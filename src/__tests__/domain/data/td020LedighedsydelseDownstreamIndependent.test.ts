import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-01-05');
  values.vedroererPeriodeTil = iso('2024-01-08');
  values.offentligeYdelserRows = [{
    id: 'ledighedsydelse-kalenderdage',
    fraDato: iso('2024-01-05'),
    tilDato: iso('2024-01-08'),
    ydelsestype: 'ledighedsydelse',
    ydelse: amount(1200),
    tillaeg: undefined,
  }];
  return values;
};

describe('td020LedighedsydelseDownstreamIndependent', () => {
  it('fører ledighedsydelse fra registret gennem EO-inspektionens kalenderdagsconsumer', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:ledighedsydelse');
    const relevantDates = [
      iso('2024-01-05'),
      iso('2024-01-06'),
      iso('2024-01-07'),
      iso('2024-01-08'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));
    const column = model.columns.find((candidate) => candidate.id === 'offentlig:ledighedsydelse');

    expect(column?.header).toBe('Ledigheds-\nydelse');
    expect(amounts).toBeDefined();
    expect(relevantIndexes).toEqual([4, 5, 6, 7]);
    if (!amounts) return;

    // Ledighedsydelse er kalenderdagsbaseret: 1.200 kr. / 4 kalenderdage = 300 kr. pr. dag.
    // Weekenddagene skal derfor have samme beløb som fredag og mandag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([300, 300, 300, 300]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:ledighedsydelse'))).toEqual([
      '300,00',
      '300,00',
      '300,00',
      '300,00',
    ]);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[1]]).toBe(false);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[2]]).toBe(false);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1200);
    expect(model.integrityIssues).toEqual([]);
  });
});

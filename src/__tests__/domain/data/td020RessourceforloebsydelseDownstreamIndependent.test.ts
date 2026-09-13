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
    id: 'ressourceforloebsydelse-kalenderdage',
    fraDato: iso('2024-05-30'),
    tilDato: iso('2024-06-02'),
    ydelsestype: 'ressourceforloebsydelse',
    ydelse: amount(2200),
    tillaeg: amount(600),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – ressourceforløbsydelse som EO-downstream-consumer', () => {
  it('fordeler samlet ydelse på kalenderdage over månedsgrænse og weekend', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:ressourceforloebsydelse');
    const relevantDates = [
      iso('2024-05-30'),
      iso('2024-05-31'),
      iso('2024-06-01'),
      iso('2024-06-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 30. maj–2. juni er fire kalenderdage. 2.200 kr. + 600 kr. = 2.800 kr.,
    // så det håndberegnede facit er 2.800 kr. / 4 = 700 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([700, 700, 700, 700]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:ressourceforloebsydelse'))).toEqual([
      '700,00',
      '700,00',
      '700,00',
      '700,00',
    ]);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[2]]).toBe(false);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[3]]).toBe(false);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(2800);
    expect(model.integrityIssues).toEqual([]);
  });
});

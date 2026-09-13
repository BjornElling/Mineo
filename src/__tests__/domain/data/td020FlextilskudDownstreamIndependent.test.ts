import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const fra = iso('2024-07-06');
  const til = iso('2024-07-07');
  const row: OffentligeYdelserRow = {
    id: 'flextilskud-ren-weekend',
    fraDato: fra,
    tilDato: til,
    ydelse: amount(700),
    tillaeg: amount(200),
    ydelsestype: 'flextilskud',
  };

  values.vedroererPeriodeFra = fra;
  values.vedroererPeriodeTil = til;
  values.offentligeYdelserRows = [row];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – flextilskud som EO-downstream-consumer', () => {
  it('fordeler kalenderdagsydelsen på en ren weekend med kontrolsum', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:flextilskud');
    const relevantDates = [iso('2024-07-06'), iso('2024-07-07')];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:flextilskud')?.header).toBe('Flextilskud');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // Flextilskud er kalenderdagsbaseret: (700 kr. + 200 kr.) / 2 kalenderdage = 450 kr. pr. dag.
    // Weekenddagene skal derfor begge have beløb, selv om ingen af dem er arbejdsdage.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([450, 450]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:flextilskud'))).toEqual([
      '450,00',
      '450,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([false, false]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(900);
    expect(model.integrityIssues).toEqual([]);
  });
});

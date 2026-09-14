import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-03-27');
  values.vedroererPeriodeTil = iso('2024-04-02');
  values.offentligeYdelserRows = [{
    id: 'feriepenge-arbejdsdage',
    fraDato: iso('2024-03-27'),
    tilDato: iso('2024-04-02'),
    ydelsestype: 'feriepenge',
    ydelse: amount(600),
    tillaeg: amount(200),
  }];
  return values;
};

describe('DATA-001/CALC-006/TD-020 – feriepenge som EO-downstream-consumer', () => {
  it('fordeler feriepenge på arbejdsdage og springer weekend og helligdage over', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:feriepenge');
    const relevantDates = [
      iso('2024-03-27'),
      iso('2024-03-28'),
      iso('2024-03-29'),
      iso('2024-03-30'),
      iso('2024-03-31'),
      iso('2024-04-01'),
      iso('2024-04-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(model.columns.find((column) => column.id === 'offentlig:feriepenge')?.header).toBe('Feriepenge');
    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 27. marts og 2. april er de eneste arbejdsdage i intervallet. 600 kr. + 200 kr. = 800 kr.,
    // så det håndberegnede facit er 800 kr. / 2 arbejdsdage = 400 kr. pr. dag.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([400, 0, 0, 0, 0, 0, 400]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:feriepenge'))).toEqual([
      '400,00',
      '',
      '',
      '',
      '',
      '',
      '400,00',
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isWorkdayByIndex[index])).toEqual([
      true,
      true,
      true,
      false,
      false,
      true,
      true,
    ]);
    expect(relevantIndexes.map((index) => model.tableData.isSognehelligdagByIndex[index])).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(800);
    expect(model.integrityIssues).toEqual([]);
  });
});

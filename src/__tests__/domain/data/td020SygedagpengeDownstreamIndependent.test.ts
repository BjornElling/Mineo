import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-12-23');
  values.vedroererPeriodeTil = iso('2024-12-27');
  values.offentligeYdelserRows = [{
    id: 'sygedagpenge-sh-facit',
    fraDato: iso('2024-12-23'),
    tilDato: iso('2024-12-27'),
    ydelsestype: 'sygedagpenge',
    ydelse: amount(3000),
    tillaeg: undefined,
  }];
  return values;
};

describe('DATA-001/TD-020 – sygedagpenge som downstream-consumer', () => {
  it('fordeler beløbet på hverdage efter helligdagsfradraget', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:sygedagpenge');
    const relevantDates = [
      iso('2024-12-23'),
      iso('2024-12-24'),
      iso('2024-12-25'),
      iso('2024-12-26'),
      iso('2024-12-27'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(amounts).toBeDefined();
    expect(relevantIndexes.every((index) => index >= 0)).toBe(true);
    if (!amounts) return;

    // 23.–27. december 2024 har tre periodiseringsdage: 25. og 26. december er helligdage.
    // 3.000 kr. / 3 hverdage = 1.000 kr. pr. dag; helligdagene skal stå tomme.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([1000, 1000, 0, 0, 1000]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:sygedagpenge'))).toEqual([
      '1.000,00',
      '1.000,00',
      '',
      '',
      '1.000,00',
    ]);
    expect(model.tableData.isSognehelligdagByIndex[relevantIndexes[2]]).toBe(true);
    expect(model.tableData.isSognehelligdagByIndex[relevantIndexes[3]]).toBe(true);
    expect(model.integrityIssues).toEqual([]);
  });
});

import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2012-04-09');
  values.vedroererPeriodeTil = iso('2012-04-13');
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Angivet dagsløn';
  values.loenindkomstAnsaettelsesforhold = [];
  values.tafPerioder = [{
    id: 'taf-2012-paaskefacit',
    fra: iso('2012-04-09'),
    til: iso('2012-04-13'),
    loseFeriedage: 0,
  }];
  values.offentligeYdelserRows = [{
    id: 'sygedagpenge-2012-paaskefacit',
    fraDato: iso('2012-04-09'),
    tilDato: iso('2012-04-13'),
    ydelsestype: 'sygedagpenge',
    ydelse: amount(900),
    tillaeg: undefined,
  }];
  return values;
};

describe('TD-016 / CALC-006 – uafhængigt sygedagpengefacit før SH-cutoff', () => {
  it('medregner påskemandag før 02-07-2012 i sygedagpengers arbejdsdagstabel', () => {
    const model = buildEOInspektionModel(buildValues(), {
      tafRanges: [{ fra: iso('2012-04-09'), til: iso('2012-04-13') }],
    });
    const amounts = model.columnRawValues.get('offentlig:sygedagpenge');
    const relevantDates = [
      iso('2012-04-09'),
      iso('2012-04-10'),
      iso('2012-04-11'),
      iso('2012-04-12'),
      iso('2012-04-13'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    expect(amounts).toBeDefined();
    if (!amounts) return;

    // 09.–13. april 2012 er mandag til fredag. Påskemandag er en SH-dag, men
    // før 02-07-2012 tæller den stadig med for sygedagpenge, så 900 kr. / 5
    // periodiseringsdage = 180 kr. pr. dag.
    expect(model.tableData.isSognehelligdagByIndex.slice(relevantIndexes[0], relevantIndexes[4] + 1)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(model.tableData.isWorkdayByIndex.slice(relevantIndexes[0], relevantIndexes[4] + 1)).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(amounts.slice(relevantIndexes[0], relevantIndexes[4] + 1)).toEqual([180, 180, 180, 180, 180]);
    expect(relevantIndexes.map((index) => model.getCell(index, 'offentlig:sygedagpenge'))).toEqual([
      '180,00',
      '180,00',
      '180,00',
      '180,00',
      '180,00',
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(900);
    expect(model.integrityIssues).toEqual([]);
  });
});

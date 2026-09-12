import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-03-30');
  values.vedroererPeriodeTil = iso('2024-04-02');
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Angivet dagsløn';
  values.dagsloenenUdgoer = amount(1000);
  values.loenindkomstAnsaettelsesforhold = [];
  values.tafPerioder = [{
    id: 'taf-calendar-benefit',
    fra: iso('2024-03-30'),
    til: iso('2024-04-02'),
    loseFeriedage: 0,
  }];
  values.offentligeYdelserRows = [{
    id: 'ydelse-calendar-benefit',
    fraDato: iso('2024-03-30'),
    tilDato: iso('2024-04-02'),
    ydelsestype: 'dagpenge',
    ydelse: amount(400),
    tillaeg: undefined,
  }];
  return values;
};

describe('CALC-006 / TD-016 – uafhængigt kalenderdags-downstreamfacit', () => {
  it('fordeler dagpenge på weekend, helligdag og hverdag med intakt rækkesum', () => {
    const model = buildEOInspektionModel(buildValues(), {
      tafRanges: [{ fra: iso('2024-03-30'), til: iso('2024-04-02') }],
    });
    const amounts = model.columnRawValues.get('offentlig:dagpenge');

    expect(amounts).toBeDefined();
    if (!amounts) return;

    const relevantDates = [
      iso('2024-03-30'),
      iso('2024-03-31'),
      iso('2024-04-01'),
      iso('2024-04-02'),
    ];
    const relevantIndexes = relevantDates.map((date) => model.tableData.dates.indexOf(date));

    // Dagpenge er kalenderdagsbaseret: 400 kr. / 4 dage = 100 kr. pr. dag.
    // 30.-31. marts er weekend, og 1. april er helligdag, men alle fire dage skal med.
    expect(relevantIndexes.map((index) => amounts[index])).toEqual([100, 100, 100, 100]);
    expect(model.getCell(relevantIndexes[0] ?? -1, 'offentlig:dagpenge')).toBe('100,00');
    expect(model.getCell(relevantIndexes[1] ?? -1, 'offentlig:dagpenge')).toBe('100,00');
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[0] ?? -1]).toBe(false);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[1] ?? -1]).toBe(false);
    expect(model.tableData.isSognehelligdagByIndex[relevantIndexes[2] ?? -1]).toBe(true);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[2] ?? -1]).toBe(false);
    expect(model.tableData.isWorkdayByIndex[relevantIndexes[3] ?? -1]).toBe(true);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(400);
    expect(model.integrityIssues).toEqual([]);
  });
});

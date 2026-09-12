import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const fra = iso('2024-01-08');
  const til = iso('2024-01-12');
  const ydelse: OffentligeYdelserRow = {
    id: 'ydelse-med-tillaeg',
    fraDato: fra,
    tilDato: til,
    ydelsestype: 'sygedagpenge',
    ydelse: amount(800),
    tillaeg: amount(200),
  };

  values.vedroererPeriodeFra = fra;
  values.vedroererPeriodeTil = til;
  values.offentligeYdelserRows = [ydelse];
  return values;
};

describe('CALC-006 – uafhængigt facit for offentlig ydelse med tillæg', () => {
  it('lægger ydelse og tillæg sammen før fordeling på arbejdsdage', () => {
    const model = buildEOInspektionModel(buildValues(), { tafRanges: [] });
    const amounts = model.columnRawValues.get('offentlig:sygedagpenge');
    const firstRelevantIndex = model.tableData.dates.indexOf(iso('2024-01-08'));

    expect(amounts).toBeDefined();
    expect(firstRelevantIndex).toBe(7);
    if (!amounts) return;

    // 800 kr. + 200 kr. fordeles som 1.000 kr. / 5 hverdage = 200 kr. pr. dag.
    expect(amounts.slice(firstRelevantIndex, firstRelevantIndex + 5)).toEqual([
      200,
      200,
      200,
      200,
      200,
    ]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(1000);
    expect(model.getCell(firstRelevantIndex, 'offentlig:sygedagpenge')).toBe('200,00');
    expect(model.integrityIssues).toEqual([]);
  });
});

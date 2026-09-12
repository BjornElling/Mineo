import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { kontrolTabelColumnId } from '../../../domain/eoInspektion/eoInspektionLoenTypes';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const createBelobModeValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const date = iso('2024-01-08');
  const row: StandardLoenTableRow = {
    id: 'beloeb-facit',
    col0_maaned: '',
    col1_maaned: '',
    col0_uge: '',
    col1_uge: '',
    col0_dag: date,
    col1_dag: date,
    col2: amount(120),
    col3: amount(30),
    col4: amount(10),
    col5: amount(5),
    fpFvShSoBeloeb: amount(20),
    pensionBeloeb: amount(15),
  };
  const employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] = {
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-beloeb-facit',
    harOverenskomst: false,
    storeBededagPct: 0,
    tillaegAngivesSom: 'beloeb',
    loenperiode: 'dag',
    indtaegtsoplysningerTableData: [row],
  };

  values.vedroererPeriodeFra = date;
  values.vedroererPeriodeTil = date;
  values.kravPaaTabtArbejdsfortjeneste = 'Nej';
  values.loenindkomstAnsaettelsesforhold = [employment];
  return values;
};

describe('CALC-006 – uafhængigt inspection-kolonnefacit for Beløb-tilstand', () => {
  it('viser direkte tillægsbeløb i lønkolonnerne og summerer rækken uden satser', () => {
    const date = iso('2024-01-08');
    const model = buildEOInspektionModel(createBelobModeValues(), { tafRanges: [] });
    const rowIndex = model.tableData.dates.indexOf(date);
    const expectedColumns = [
      { id: kontrolTabelColumnId.loenWage(0, 'grundloen'), amount: 120, text: '120,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'tillaeg'), amount: 30, text: '30,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'ikkePensionsgivende'), amount: 10, text: '10,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'atp'), amount: 5, text: '5,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'fpFvShSoStb'), amount: 20, text: '20,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'pension'), amount: 15, text: '15,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'samlet'), amount: 200, text: '200,00' },
    ] as const;

    expect(rowIndex).toBe(7);
    expect(model.columns.map((column) => column.id).filter((id) => id.includes(':wage:'))).toEqual(
      expectedColumns.map(({ id }) => id)
    );

    for (const expected of expectedColumns) {
      const rawValues = model.columnRawValues.get(expected.id);
      expect(rawValues).toBeDefined();
      if (!rawValues) return;

      expect(rawValues[rowIndex]).toBe(expected.amount);
      expect(rawValues.reduce((sum, value) => sum + value, 0)).toBe(expected.amount);
      expect(model.getCell(rowIndex, expected.id)).toBe(expected.text);
    }

    // 120 + 30 + 10 + 5 + 20 + 15 = 200 kr. Samme bogholderi skal være uden mismatch.
    expect(model.integrityIssues).toEqual([]);
  });
});

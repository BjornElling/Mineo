import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { kontrolTabelColumnId } from '../../../domain/eoInspektion/eoInspektionLoenTypes';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const createWeekModeValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const fra = iso('2024-01-08');
  const til = iso('2024-01-14');
  const row: StandardLoenTableRow = {
    id: 'uge-facit',
    col0_maaned: '',
    col1_maaned: '',
    col0_uge: '02/2024',
    col1_uge: '02/2024',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: amount(700),
    col3: amount(70),
    col4: amount(30),
    col5: amount(10),
    fpFvShSoBeloeb: amount(50),
    pensionBeloeb: amount(40),
  };
  const employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] = {
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-uge-facit',
    harOverenskomst: false,
    storeBededagPct: 0,
    tillaegAngivesSom: 'beloeb',
    loenperiode: 'uge',
    indtaegtsoplysningerTableData: [row],
  };

  values.vedroererPeriodeFra = fra;
  values.vedroererPeriodeTil = til;
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Angivet dagsløn';
  values.dagsloenenUdgoer = amount(1000);
  values.tafPerioder = [{ id: 'taf-uge-facit', fra, til, loseFeriedage: 0 }];
  values.loenindkomstAnsaettelsesforhold = [employment];
  return values;
};

describe('CALC-006 – uafhængigt inspection-kolonnefacit for ugeperiode', () => {
  it('fordeler en uge-række i Beløb-tilstand på fem hverdage', () => {
    const model = buildEOInspektionModel(createWeekModeValues(), {
      tafRanges: [{ fra: iso('2024-01-08'), til: iso('2024-01-14') }],
    });
    const rowIndex = model.tableData.dates.indexOf(iso('2024-01-08'));
    const expectedColumns = [
      { id: kontrolTabelColumnId.loenWage(0, 'grundloen'), amount: 140, text: '140,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'tillaeg'), amount: 14, text: '14,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'ikkePensionsgivende'), amount: 6, text: '6,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'atp'), amount: 2, text: '2,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'fpFvShSoStb'), amount: 10, text: '10,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'pension'), amount: 8, text: '8,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'samlet'), amount: 180, text: '180,00' },
    ] as const;

    expect(rowIndex).toBe(7);
    expect(model.columns.map((column) => column.id).filter((id) => id.includes(':wage:'))).toEqual(
      expectedColumns.map(({ id }) => id)
    );

    for (const expected of expectedColumns) {
      const rawValues = model.columnRawValues.get(expected.id);
      expect(rawValues).toBeDefined();
      if (!rawValues) return;

      expect(rawValues.slice(rowIndex, rowIndex + 7)).toEqual([
        expected.amount,
        expected.amount,
        expected.amount,
        expected.amount,
        expected.amount,
        0,
        0,
      ]);
      expect(rawValues.reduce((sum, value) => sum + value, 0)).toBe(expected.amount * 5);
      expect(model.getCell(rowIndex, expected.id)).toBe(expected.text);
    }

    // 700 + 70 + 30 + 10 + 50 + 40 = 900 kr. fordelt på fem hverdage giver 180 kr. pr. dag.
    expect(model.integrityIssues).toEqual([]);
  });
});

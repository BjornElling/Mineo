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

const createMonthModeValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const row: StandardLoenTableRow = {
    id: 'maaned-facit',
    col0_maaned: '1',
    col1_maaned: '2024',
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: amount(3100),
    col3: amount(310),
    col4: amount(62),
    col5: amount(31),
    fpFvShSoBeloeb: amount(155),
    pensionBeloeb: amount(124),
  };
  const employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] = {
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-maaned-facit',
    harOverenskomst: false,
    tillaegAngivesSom: 'beloeb',
    loenperiode: 'maaned',
    indtaegtsoplysningerTableData: [row],
  };

  values.beregnesUdFra = 'Angivet månedsløn';
  values.vedroererPeriodeFra = iso('2024-01-01');
  values.vedroererPeriodeTil = iso('2024-01-31');
  values.loenindkomstAnsaettelsesforhold = [employment];
  return values;
};

describe('CALC-006 – uafhængigt inspection-facit for månedsløn', () => {
  it('fordeler en månedsløn på alle kalenderdage med intakte lønkolonner og kontrolsum', () => {
    const model = buildEOInspektionModel(createMonthModeValues(), { tafRanges: [] });
    const januaryFirstIndex = model.tableData.dates.indexOf(iso('2024-01-01'));
    const expectedColumns = [
      { id: kontrolTabelColumnId.loenWage(0, 'grundloen'), amount: 100, text: '100,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'tillaeg'), amount: 10, text: '10,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'ikkePensionsgivende'), amount: 2, text: '2,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'atp'), amount: 1, text: '1,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'fpFvShSoStb'), amount: 5, text: '5,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'pension'), amount: 4, text: '4,00' },
      { id: kontrolTabelColumnId.loenWage(0, 'samlet'), amount: 122, text: '122,00' },
    ] as const;

    expect(model.tableData.dates).toHaveLength(31);
    expect(januaryFirstIndex).toBe(0);
    expect(model.columns.map((column) => column.id).filter((id) => id.includes(':wage:'))).toEqual(
      expectedColumns.map(({ id }) => id)
    );

    for (const expected of expectedColumns) {
      const rawValues = model.columnRawValues.get(expected.id);
      expect(rawValues).toBeDefined();
      if (!rawValues) return;

      expect(rawValues.slice(0, 31)).toEqual(Array.from({ length: 31 }, () => expected.amount));
      expect(rawValues.reduce((sum, value) => sum + value, 0)).toBe(expected.amount * 31);
      expect(model.getCell(januaryFirstIndex, expected.id)).toBe(expected.text);
    }

    // 3.782 kr. fordelt på 31 kalenderdage giver 122 kr. pr. dag i alle kolonner samlet.
    expect(model.integrityIssues).toEqual([]);
  });
});

import {
  applyRegisteredTableSaveOrder,
  clearTableSaveOrderRegistryForTests,
  isTableSaveOrderPath,
  registerTableSaveOrder,
} from '../../utils/tableSaveOrderRegistry';
import type { SaveSnapshot } from '../../utils/fileSaveTypes';

describe('tableSaveOrderRegistry', () => {
  afterEach(() => {
    clearTableSaveOrderRegistryForTests();
    vi.restoreAllMocks();
  });

  it('reordner rows i snapshot efter registreret synlig rækkefølge', () => {
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['b', 'a', 'c']);

    const snapshot: SaveSnapshot = {
      stamdata: undefined,
      satser: undefined,
      aarsloen: undefined,
      faellesAarsloen: undefined,
      renteberegning: undefined,
      varigemen: undefined,
      forsoergertab: undefined,
      erhvervsevnetab: undefined,
      erstatningsopgoerelse: {
        offentligeYdelserRows: [
          { id: 'a', ydelse: { kind: 'number', value: 1 } },
          { id: 'b', ydelse: { kind: 'number', value: 2 } },
          { id: 'c', ydelse: { kind: 'number', value: 3 } },
        ],
      },
    };

    const result = applyRegisteredTableSaveOrder(snapshot);
    const rows = (result.erstatningsopgoerelse as { offentligeYdelserRows: Array<{ id: string }> }).offentligeYdelserRows;

    expect(rows.map((row) => row.id)).toEqual(['b', 'a', 'c']);
  });

  it('reordner nested table-paths uden at røre andre rows', () => {
    registerTableSaveOrder('erstatningsopgoerelse.ansaettelsesforhold.1.indtaegtsoplysningerTableData', ['r2', 'r1']);

    const snapshot: SaveSnapshot = {
      stamdata: undefined,
      satser: undefined,
      aarsloen: undefined,
      faellesAarsloen: undefined,
      renteberegning: undefined,
      varigemen: undefined,
      forsoergertab: undefined,
      erhvervsevnetab: undefined,
      erstatningsopgoerelse: {
        ansaettelsesforhold: [
          {
            id: 'af1',
            indtaegtsoplysningerTableData: [{ id: 'x1' }, { id: 'x2' }],
          },
          {
            id: 'af2',
            indtaegtsoplysningerTableData: [{ id: 'r1' }, { id: 'r2' }],
          },
        ],
      },
    };

    const result = applyRegisteredTableSaveOrder(snapshot);
    const ansaettelsesforhold = (result.erstatningsopgoerelse as {
      ansaettelsesforhold: Array<{ indtaegtsoplysningerTableData: Array<{ id: string }> }>;
    }).ansaettelsesforhold;

    expect(ansaettelsesforhold[0]?.indtaegtsoplysningerTableData.map((row) => row.id)).toEqual(['x1', 'x2']);
    expect(ansaettelsesforhold[1]?.indtaegtsoplysningerTableData.map((row) => row.id)).toEqual(['r2', 'r1']);
  });

  it('afviser ugyldige paths før registrering', () => {
    expect(isTableSaveOrderPath('erstatningsopgoerelse')).toBe(false);
    expect(isTableSaveOrderPath('ukendt.rows')).toBe(false);
    expect(isTableSaveOrderPath('erstatningsopgoerelse..rows')).toBe(false);
  });

  it('logger fejl ved dobbeltregistrering af samme path', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['a']);
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['b']);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

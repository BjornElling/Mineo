import {
  applyRegisteredTableSaveOrder,
  clearTableSaveOrderRegistryForTests,
  isTableSaveOrderPath,
  registerTableSaveOrder,
  unregisterTableSaveOrder,
} from '../../utils/tableSaveOrderRegistry';
import type { SaveSnapshot } from '../../utils/fileSaveTypes';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

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
        ...createErstatningsopgoerelseInitialValues(),
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
    registerTableSaveOrder('erstatningsopgoerelse.loenindkomstAnsaettelsesforhold.1.indtaegtsoplysningerTableData', ['r2', 'r1']);

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
        ...createErstatningsopgoerelseInitialValues(),
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af1',
            indtaegtsoplysningerTableData: [{ id: 'x1' }, { id: 'x2' }],
          },
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af2',
            indtaegtsoplysningerTableData: [{ id: 'r1' }, { id: 'r2' }],
          },
        ],
      },
    };

    const result = applyRegisteredTableSaveOrder(snapshot);
    const ansaettelsesforhold = result.erstatningsopgoerelse?.loenindkomstAnsaettelsesforhold;
    expect(ansaettelsesforhold).toBeDefined();
    if (!ansaettelsesforhold) return;

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

  it('fjerner en registreret rækkefølge igen', () => {
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['b', 'a']);
    unregisterTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows');

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
        ...createErstatningsopgoerelseInitialValues(),
        offentligeYdelserRows: [{ id: 'a' }, { id: 'b' }] as never,
      },
    };

    expect(applyRegisteredTableSaveOrder(snapshot)).toBe(snapshot);
  });

  it('afviser registrering med ukendt eller tomt path-segment', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    registerTableSaveOrder('ukendt.rows' as TableSaveOrderPath, ['a']);
    registerTableSaveOrder('erstatningsopgoerelse..rows' as TableSaveOrderPath, ['a']);
    registerTableSaveOrder('erstatningsopgoerelse' as TableSaveOrderPath, ['a']);

    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(applyRegisteredTableSaveOrder({
      stamdata: undefined,
      satser: undefined,
      aarsloen: undefined,
      faellesAarsloen: undefined,
      renteberegning: undefined,
      varigemen: undefined,
      forsoergertab: undefined,
      erstatningsopgoerelse: undefined,
      erhvervsevnetab: undefined,
    })).toEqual({
      stamdata: undefined,
      satser: undefined,
      aarsloen: undefined,
      faellesAarsloen: undefined,
      renteberegning: undefined,
      varigemen: undefined,
      forsoergertab: undefined,
      erstatningsopgoerelse: undefined,
      erhvervsevnetab: undefined,
    });
  });

  it('bevarer rows ved kort rækkefølge og ikke-string-id’er og ignorerer duplikater i rækkefølgen', () => {
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['a']);
    const shortOrderSnapshot: SaveSnapshot = {
      stamdata: undefined,
      satser: undefined,
      aarsloen: undefined,
      faellesAarsloen: undefined,
      renteberegning: undefined,
      varigemen: undefined,
      forsoergertab: undefined,
      erhvervsevnetab: undefined,
      erstatningsopgoerelse: {
        ...createErstatningsopgoerelseInitialValues(),
        offentligeYdelserRows: [{ id: 'a' }, { id: 'b' }] as never,
      },
    };
    const shortOrderResult = applyRegisteredTableSaveOrder(shortOrderSnapshot);
    expect((shortOrderResult.erstatningsopgoerelse as { offentligeYdelserRows: Array<{ id: string }> }).offentligeYdelserRows)
      .toEqual([{ id: 'a' }, { id: 'b' }]);

    clearTableSaveOrderRegistryForTests();
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['a', 'a', 'missing']);
    const duplicateOrderResult = applyRegisteredTableSaveOrder(shortOrderSnapshot);
    expect((duplicateOrderResult.erstatningsopgoerelse as { offentligeYdelserRows: Array<{ id: string }> }).offentligeYdelserRows)
      .toEqual([{ id: 'a' }, { id: 'b' }]);

    clearTableSaveOrderRegistryForTests();
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows', ['a']);
    const nonStringIdSnapshot: SaveSnapshot = {
      ...shortOrderSnapshot,
      erstatningsopgoerelse: {
        ...createErstatningsopgoerelseInitialValues(),
        offentligeYdelserRows: [{ id: 'a' }, { id: 1 }] as never,
      },
    };
    expect(applyRegisteredTableSaveOrder(nonStringIdSnapshot)).toBe(nonStringIdSnapshot);
  });

  it('bevarer snapshot ved ugyldig nested indeks, manglende property og primitive leaf', () => {
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
        ...createErstatningsopgoerelseInitialValues(),
        offentligeYdelserRows: [{ id: 'a', ydelse: { kind: 'number', value: 1 } }] as never,
      },
    };

    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows.9', ['a']);
    expect(applyRegisteredTableSaveOrder(snapshot)).toBe(snapshot);

    clearTableSaveOrderRegistryForTests();
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows.0.missing', ['a']);
    expect(applyRegisteredTableSaveOrder(snapshot)).toBe(snapshot);

    clearTableSaveOrderRegistryForTests();
    registerTableSaveOrder('erstatningsopgoerelse.offentligeYdelserRows.0.ydelse.value.foo', ['a']);
    expect(applyRegisteredTableSaveOrder(snapshot)).toBe(snapshot);

    clearTableSaveOrderRegistryForTests();
    registerTableSaveOrder('stamdata.rows', ['a']);
    expect(applyRegisteredTableSaveOrder(snapshot)).toBe(snapshot);
  });
});

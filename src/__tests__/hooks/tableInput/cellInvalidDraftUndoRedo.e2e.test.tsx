// @vitest-environment jsdom
//
// Bred ende-til-ende-dækning af undo/redo for UGYLDIGE indtastninger i TABEL-celler — drevet gennem
// den rigtige useTableInputCore (med dens reelle commitAndEmitBlur/clearAndCommit/cancelEdit-stier),
// den rigtige FormPersistenceProvider og den samlede input-history. Formålet er at fange
// den rigtige undoRedoStore. Formålet er at fange "rydning fanger ingen undo-frame"-klassen af fejl
// (rapporteret for datoceller) bredt — på tværs af clear-stier, redo, flere celler og samspil med
// værdi-commits.
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';

import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';
import { makeStringFingerprintFromCanonical } from '../../../types/parserSpec';
import type { TableInputAdapter } from '../../../hooks/tableInput';
import { useTableInputCore } from '../../../hooks/tableInput';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../../stores/undoRedoStore';
import { executeInputTransaction } from '../../../input/inputTransactionRunner';
import { __resetLegacyGridTransactionBridgeForTests } from '../../../input/legacyGridTransactionBridge';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';

const PAGE_KEY = 'erstatningsopgoerelse' as const;
const TABLE_ID = CELL_TABLE_IDS.eoOffentligeYdelser;

// En "dato-agtig" adapter: ikke-tomt og != en gyldig kanonisk værdi → ugyldig (kan ikke committes).
// "12" og "31-02-2020" er ugyldige (som rigtige uparsbare datoer); en 10-tegns dd-mm-åååå er gyldig.
const isValidCanonical = (s: string): boolean => /^\d{2}-\d{2}-\d{4}$/.test(s);
const createDateLikeAdapter = (): TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> => ({
  format: (value) => value,
  parse: (draft) => {
    const trimmed = draft.trim();
    if (trimmed === '') return { ok: true, value: '' };
    if (!isValidCanonical(trimmed)) return { ok: false, errorMessage: 'Ugyldig dato' };
    return { ok: true, value: trimmed };
  },
  toCommittedPayload: (value) => ({
    model: value,
    canonical: value,
    fingerprint: makeStringFingerprintFromCanonical(value),
  }),
  isValidStartKey: (key) => key.length === 1,
  preserveInvalidDraft: true,
  useSaveError: true,
});

type CoreResult = ReturnType<typeof useTableInputCore>;

type CellHarness = {
  result: { current: CoreResult };
  editor: () => GridCellEditorHandle;
  setEditing: (editing: boolean) => void;
  rerender: () => void;
};

const renderCell = (
  gridCell: GridCellCoord,
  value: string,
  rowScope = '',
  onBlur?: (e: { target: { value: string } }) => void,
  adapter: TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> = createDateLikeAdapter(),
  persistenceRuntime: ReturnType<typeof initializePersistenceRuntime> = initializePersistenceRuntime()
): CellHarness => {
  const state: { editingCell: GridCellCoord | null } = { editingCell: null };
  let handle: GridCellEditorHandle | null = null;

  const store: GridCoreStateStore = {
    subscribe: () => () => undefined,
    getFocusedCell: () => gridCell,
    getEditingCell: () => state.editingCell,
  };
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <FormPersistenceProvider runtime={persistenceRuntime}>
      <CellInvalidDraftScopeProvider pageKey={PAGE_KEY} tableId={TABLE_ID} rowScope={rowScope}>
        <GridCoreProvider
          value={{
            gridStateStore: store,
            openEditing: vi.fn(),
            closeEditing: () => { state.editingCell = null; },
            registerEditor: (_cell, h) => { handle = h; },
            unregisterEditor: vi.fn(),
            getEditor: vi.fn().mockReturnValue(null),
            requestFocusPlan: vi.fn(),
          }}
        >
          {children}
        </GridCoreProvider>
      </CellInvalidDraftScopeProvider>
    </FormPersistenceProvider>
  );

  const { result, rerender } = renderHook(
    () => useTableInputCore({ adapter, gridCell, value, onBlur }),
    { wrapper }
  );

  return {
    result,
    editor: () => {
      if (!handle) throw new Error('editor handle ikke registreret');
      return handle;
    },
    setEditing: (editing: boolean) => { state.editingCell = editing ? gridCell : null; rerender(); },
    rerender,
  };
};

const drafts = () => formPersistenceStore.getState().invalidDrafts[PAGE_KEY] ?? {};
const pathFor = (gridCellKey: string, rowScope = '') => buildCellInvalidDraftFieldPath(TABLE_ID, rowScope, gridCellKey);
const pastLen = () => undoRedoStore.getState().past.length;
const futureLen = () => undoRedoStore.getState().future.length;

// Anvend en planlagt transition på den rigtige store (samme sekvens som useUndoRedo's restorePlannedTransition).
const undo = () => act(() => { executeInputTransaction({ kind: 'undo' }); });
const redo = () => act(() => { executeInputTransaction({ kind: 'redo' }); });

// Skriv en ugyldig draft i cellen (svarer til at taste den + blur/commit).
const typeAndCommit = (h: CellHarness, raw: string) => {
  h.setEditing(true);
  act(() => { h.result.current.handleChange({ target: { value: raw } } as React.ChangeEvent<HTMLInputElement>); });
  act(() => { h.editor().commitCurrent(); });
  h.setEditing(false);
};

// Ryd cellen via grid-Delete-stien (clearAndCommit) — den sti brugeren rammer ved at trykke Delete.
const clearViaDelete = (h: CellHarness) => {
  act(() => { h.editor().clearAndCommit(); });
};

beforeEach(() => {
  sessionStorage.clear();
  __resetLegacyGridTransactionBridgeForTests();
  __resetUndoRedoStoreForTests();
  formPersistenceStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION, lastCommittedAt: 1 });
});

describe('tabelcelle undo/redo af ugyldige indtastninger (ende-til-ende)', () => {
  it('brugerens scenarie: skriv ugyldig dato, ryd med Delete, undo → ugyldig værdi gendannes', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');

    typeAndCommit(h, '12');
    expect(drafts()[fp]).toBe('12');
    expect(pastLen()).toBe(1);

    clearViaDelete(h);
    expect(drafts()[fp]).toBeUndefined();
    expect(pastLen()).toBe(2);

    undo();
    expect(drafts()[fp]).toBe('12');
  });

  it('undo gendanner draften til cellens display efter epoch-resync', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '31-02'); // ugyldig (ufuldstændig dato, fejler format)
    clearViaDelete(h);
    expect(h.result.current.renderedValue).toBe('');

    undo();
    h.rerender();
    expect(drafts()[fp]).toBe('31-02');
    expect(h.result.current.renderedValue).toBe('31-02');
    expect(h.result.current.hasError).toBe(true);
  });

  it('redo efter undo gen-udfører rydningen (cellen tom igen)', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '12');
    clearViaDelete(h);
    undo();
    expect(drafts()[fp]).toBe('12');
    expect(futureLen()).toBe(1);

    redo();
    expect(drafts()[fp]).toBeUndefined();
  });

  it('fuld undo-kæde: tom → ugyldig → ryddet, undo to gange tilbage til ugyldig så tom', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '12');
    clearViaDelete(h);
    expect(pastLen()).toBe(2);

    undo();
    expect(drafts()[fp]).toBe('12');
    undo();
    expect(drafts()[fp]).toBeUndefined();
    expect(undoRedoStore.getState().canUndo()).toBe(false);
  });

  it('rydning via blur (readOnly editor lukket men pending draft) fanger også en frame', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '12');
    expect(pastLen()).toBe(1);

    // Ryd ved at åbne editoren, tømme draften og blur'e (commit af tom værdi).
    h.setEditing(true);
    act(() => { h.result.current.handleChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>); });
    act(() => { h.result.current.handleBlur({ currentTarget: { value: '', readOnly: false } } as React.FocusEvent<HTMLInputElement>); });

    expect(drafts()[fp]).toBeUndefined();
    expect(pastLen()).toBe(2);
    undo();
    expect(drafts()[fp]).toBe('12');
  });

  it('to celler: ryd hver, undo fortryder ét clear ad gangen (ikke begge, ikke det forkerte)', () => {
    // Begge hooks deler runtime. En ny initialization efter første mount ville re-hydrere den globale
    // persistence-store uden for testens act-grænse og skjule en reel cross-root state-opdatering som warning.
    const persistenceRuntime = initializePersistenceRuntime();
    const adapter = createDateLikeAdapter();
    const a = renderCell({ rowId: 'row1', colIndex: 2 }, '', '', undefined, adapter, persistenceRuntime);
    const b = renderCell({ rowId: 'row1', colIndex: 3 }, '', '', undefined, adapter, persistenceRuntime);
    const fpA = pathFor('row1:2');
    const fpB = pathFor('row1:3');

    typeAndCommit(a, '12');
    typeAndCommit(b, '34');
    expect(drafts()).toEqual({ [fpA]: '12', [fpB]: '34' });

    clearViaDelete(a);
    expect(drafts()).toEqual({ [fpB]: '34' });
    clearViaDelete(b);
    expect(drafts()).toEqual({});

    undo(); // fortryd B-clear
    expect(drafts()).toEqual({ [fpB]: '34' });
    undo(); // fortryd A-clear
    expect(drafts()).toEqual({ [fpA]: '12', [fpB]: '34' });
    undo(); // fortryd B-indtastning
    expect(drafts()).toEqual({ [fpA]: '12' });
    undo(); // fortryd A-indtastning
    expect(drafts()).toEqual({});
  });

  it('skift én ugyldig værdi til en anden ugyldig værdi er undo-bar', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '12');
    typeAndCommit(h, '99'); // anden ugyldig
    expect(drafts()[fp]).toBe('99');

    undo();
    expect(drafts()[fp]).toBe('12');
    undo();
    expect(drafts()[fp]).toBeUndefined();
  });

  it('rettelse ugyldig→gyldig bevarer rejected tekst, indtil værdipersistencen anvender staged clear', () => {
    // Denne isolerede callback persisterer bevidst ingen sektionsværdi. Gridbroen må derfor ikke rydde
    // rejected input separat; ellers ville en efterfølgende persistencefejl give datatab. Den fulde
    // atomiske consumption dækkes i legacyGridTransactionBridge.test.tsx.
    let draftPresentAtValueCommit: boolean | null = null;
    const fp = pathFor('row1:2');
    const onBlur = () => {
      draftPresentAtValueCommit = drafts()[fp] !== undefined;
    };
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '', '', onBlur);

    typeAndCommit(h, '12'); // ugyldig → skriver invalid draft
    expect(drafts()[fp]).toBe('12');

    typeAndCommit(h, '01-01-2020');
    expect(draftPresentAtValueCommit).toBe(true);
    expect(drafts()[fp]).toBe('12');
  });

  it('DEV-guard: adapter med visualErrorMessage uden getCommittedVisualError logger fejl (parret invariant)', () => {
    // En adapter der kan returnere en committbar-men-visuel-fejl (out-of-range), men IKKE implementerer
    // getCommittedVisualError, ville få den visuelle fejl ryddet ved editor-luk. Guarden i useTableInputCore
    // skal fange parrings-bruddet i DEV. (Selv-test af guarden, jf. guard-self-test-princippet.)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      // Violating adapter: parse af "99" er committbar men markeret som visuel fejl; ingen getCommittedVisualError.
      const violating: TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> = {
        format: (v) => v,
        parse: (draft) => {
          const t = draft.trim();
          if (t === '') return { ok: true, value: '' };
          return { ok: true, value: t, visualErrorMessage: 'Uden for interval' };
        },
        toCommittedPayload: (v) => ({ model: v, canonical: v, fingerprint: makeStringFingerprintFromCanonical(v) }),
        isValidStartKey: (key) => key.length === 1,
      };
      const h = renderCell({ rowId: 'row9', colIndex: 4 }, '', '', undefined, violating);
      typeAndCommit(h, '99');
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('getCommittedVisualError')
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('DEV-guard: parret adapter (visualErrorMessage + getCommittedVisualError) logger IKKE', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const paired: TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> = {
        format: (v) => v,
        parse: (draft) => {
          const t = draft.trim();
          if (t === '') return { ok: true, value: '' };
          return { ok: true, value: t, visualErrorMessage: 'Uden for interval' };
        },
        toCommittedPayload: (v) => ({ model: v, canonical: v, fingerprint: makeStringFingerprintFromCanonical(v) }),
        getCommittedVisualError: (v) => (v === '' ? '' : 'Uden for interval'),
        isValidStartKey: (key) => key.length === 1,
      };
      const h = renderCell({ rowId: 'row9', colIndex: 5 }, '', '', undefined, paired);
      typeAndCommit(h, '99');
      const guardCalls = consoleError.mock.calls.filter((args) =>
        typeof args[0] === 'string' && args[0].includes('getCommittedVisualError')
      );
      expect(guardCalls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('Escape gendanner en allerede afsluttet ugyldig draft uden ny transaktion', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '12');
    expect(drafts()[fp]).toBe('12');
    const pastAfterCommit = pastLen();

    h.setEditing(true);
    act(() => {
      h.result.current.handleChange({ target: { value: '01-01-2024' } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(h.result.current.draft).toBe('01-01-2024');
    act(() => { h.editor().cancelEdit(); });

    expect(drafts()[fp]).toBe('12');
    expect(h.result.current.draft).toBe('12');
    expect(pastLen()).toBe(pastAfterCommit);
  });

  it('Escape efter tastaturåbning gendanner den ugyldige starttilstand', () => {
    const h = renderCell({ rowId: 'row1', colIndex: 2 }, '');
    const fp = pathFor('row1:2');
    typeAndCommit(h, '12');
    const pastAfterCommit = pastLen();

    act(() => {
      expect(h.editor().prepareEditFromKey('0')).toBe(true);
    });
    h.setEditing(true);
    expect(h.result.current.draft).toBe('0');
    act(() => { h.editor().cancelEdit(); });

    expect(drafts()[fp]).toBe('12');
    expect(h.result.current.draft).toBe('12');
    expect(pastLen()).toBe(pastAfterCommit);
  });
});

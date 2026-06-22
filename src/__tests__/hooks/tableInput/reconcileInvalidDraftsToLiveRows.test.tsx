// @vitest-environment jsdom
//
// B7-regression: en celle-`invalidDraft` der bliver forældreløs ved række-/scope-sletning blokerede Gem
// som et spøgelses-mål uden synligt felt (overlevede F5). `useReconcileInvalidDraftsToLiveRows` +
// `reconcileInvalidDrafts` rydder den nu mod de RENDEREDE rækker / levende rowScopes — `invalidDrafts`-
// kanalens modstykke til `useTableCellErrorTracker`s read-time-filtrering. Her dækkes: fieldPath-scope-
// helpers, selve hook-mekanikken (bundet via reelle providers), at fremmede scopes ikke røres, at der
// IKKE fanges en undo-frame (housekeeping), og at Gem-gaten (getFirstBlockingInputErrorTarget) går fra
// blokeret til fri.
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';

import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../../contexts/useFormPersistence';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import {
  CELL_TABLE_IDS,
  buildCellInvalidDraftFieldPath,
  extractCellRowIdForScope,
  extractCellRowScope,
  isCellInvalidDraftRowOrphan,
  isCellInvalidDraftScopeOrphan,
} from '../../../config/cellInvalidDraftScopes';
import { useReconcileInvalidDraftsToLiveRows } from '../../../hooks/tableInput';
import { getFirstBlockingInputErrorTarget } from '../../../utils/saveBlockedFocus';
import {
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftsForSectionSnapshot,
} from '../../../stores/formPersistenceReadModel';

const PAGE_KEY = 'erstatningsopgoerelse' as const;
const TABLE_ID = CELL_TABLE_IDS.eoOffentligeYdelser;

const drafts = () => formPersistenceStore.getState().invalidDrafts[PAGE_KEY] ?? {};
const pastLen = () => undoRedoStore.getState().past.length;
const seedDraft = (fieldPath: string, raw: string) =>
  act(() => { formPersistenceStore.getState().setInvalidDraft(PAGE_KEY, fieldPath, raw); });

beforeEach(() => {
  sessionStorage.clear();
  __resetUndoRedoStoreForTests();
  formPersistenceStore.getState().clearAll({ hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION, lastCommittedAt: 1 });
});

describe('fieldPath-scope helpers', () => {
  it('extractCellRowIdForScope returnerer rowId for egen scope, null for fremmed', () => {
    const fp = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'row1:2'); // eo-offentlige-ydelser:row1:2
    expect(extractCellRowIdForScope(fp, TABLE_ID, '')).toBe('row1');
    expect(extractCellRowIdForScope(fp, CELL_TABLE_IDS.eoSvieSmerte, '')).toBeNull();
  });

  it('extractCellRowIdForScope respekterer ikke-tomt rowScope (ansættelsesforhold)', () => {
    const fp = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-7', 'rowA:1');
    expect(extractCellRowIdForScope(fp, CELL_TABLE_IDS.eoStandardLoen, 'af-7')).toBe('rowA');
    // Et ANDET af-scope (af-9) deler tableId men ikke præfikset `${tableId}:${rowScope}:` → null. Dette er
    // den reelle isolation: hver af-tabel rendres med sit eget rowScope, så af-A's reconcile aldrig rører
    // af-B's nøgler. (Et tableId bruges ALDRIG med både tomt og ikke-tomt rowScope, så `${tableId}:`-
    // præfikset kolliderer aldrig på tværs af scopes — jf. cellInvalidDraftScopes.)
    expect(extractCellRowIdForScope(fp, CELL_TABLE_IDS.eoStandardLoen, 'af-9')).toBeNull();
  });

  it('extractCellRowScope udtrækker af-id-segmentet', () => {
    const fp = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoLoenudvikling, 'af-3', 'rowZ:0');
    expect(extractCellRowScope(fp, CELL_TABLE_IDS.eoLoenudvikling)).toBe('af-3');
    expect(extractCellRowScope(fp, CELL_TABLE_IDS.eoStandardLoen)).toBeNull();
  });

  it('isCellInvalidDraftRowOrphan er sand kun for egen scope + død række', () => {
    const fp = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'row2:1');
    expect(isCellInvalidDraftRowOrphan(fp, TABLE_ID, '', new Set(['row1', 'row2']))).toBe(false); // lever
    expect(isCellInvalidDraftRowOrphan(fp, TABLE_ID, '', new Set(['row1']))).toBe(true); // død
    expect(isCellInvalidDraftRowOrphan(fp, CELL_TABLE_IDS.eoSvieSmerte, '', new Set())).toBe(false); // fremmed scope
  });

  it('isCellInvalidDraftScopeOrphan er sand kun når rowScope (af) ikke længere lever', () => {
    const fp = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-7', 'rowA:1');
    const tableIds = [CELL_TABLE_IDS.eoStandardLoen, CELL_TABLE_IDS.eoLoenudvikling];
    expect(isCellInvalidDraftScopeOrphan(fp, tableIds, new Set(['af-7']))).toBe(false);
    expect(isCellInvalidDraftScopeOrphan(fp, tableIds, new Set(['af-1']))).toBe(true);
    // Fremmed tabel-id → ikke en af-scoped nøgle → aldrig forældreløs ad denne vej.
    expect(isCellInvalidDraftScopeOrphan(buildCellInvalidDraftFieldPath(TABLE_ID, '', 'r:1'), tableIds, new Set())).toBe(false);
  });
});

describe('useReconcileInvalidDraftsToLiveRows (bundet via providers)', () => {
  const renderReconcile = (rowScope: string, initialLive: ReadonlySet<string>) => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <FormPersistenceProvider>
        <CellInvalidDraftScopeProvider pageKey={PAGE_KEY} tableId={TABLE_ID} rowScope={rowScope}>
          {children}
        </CellInvalidDraftScopeProvider>
      </FormPersistenceProvider>
    );
    return renderHook(({ liveRowIds }: { liveRowIds: ReadonlySet<string> }) => useReconcileInvalidDraftsToLiveRows(liveRowIds), {
      wrapper,
      initialProps: { liveRowIds: initialLive },
    });
  };

  it('rydder en slettet rækkes draft, bevarer levende rækkers — uden at fange en undo-frame', () => {
    const { rerender } = renderReconcile('', new Set(['row1', 'row2', 'row3']));
    const fp1 = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'row1:2');
    const fp2 = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'row2:2');
    const fp3 = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'row3:2');
    seedDraft(fp1, '12');
    seedDraft(fp2, '34');
    seedDraft(fp3, '56');
    const pastBefore = pastLen();

    // Slet row2 (forsvinder fra de renderede rækker).
    act(() => { rerender({ liveRowIds: new Set(['row1', 'row3']) }); });

    expect(drafts()[fp2]).toBeUndefined(); // forældreløs ryddet
    expect(drafts()[fp1]).toBe('12'); // levende bevaret
    expect(drafts()[fp3]).toBe('56');
    expect(pastLen()).toBe(pastBefore); // housekeeping → ingen undo-frame
  });

  it('rører ikke et FREMMED scopes drafts', () => {
    const { rerender } = renderReconcile('', new Set(['row1']));
    // Draft i et andet table-id i samme sektion.
    const foreign = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoSvieSmerte, '', 'row1:0');
    seedDraft(foreign, 'xx');
    act(() => { rerender({ liveRowIds: new Set([]) }); }); // alle "egne" rækker væk

    expect(drafts()[foreign]).toBe('xx'); // urørt
  });

  it('en draft på en stadig-renderet (men ellers tom) række bevares — adfærdsbevarende', () => {
    // Liveness = renderede rækker, ikke committede: en tom række med kun en ugyldig draft er stadig
    // synlig, så dens draft skal fortsat blokere Gem (uændret adfærd) — kun en FJERNET række ryddes.
    const { rerender } = renderReconcile('', new Set(['rowEmpty']));
    const fp = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'rowEmpty:2');
    seedDraft(fp, '99');
    act(() => { rerender({ liveRowIds: new Set(['rowEmpty']) }); }); // uændret rækkesæt
    expect(drafts()[fp]).toBe('99');
  });
});

describe('Gem-gaten: forældreløs draft går fra blokeret til fri', () => {
  it('getFirstBlockingInputErrorTarget blokerer på orphan og er fri efter reconcile', () => {
    // Provider mountes FØR seed: dens hydrate rydder invalidDrafts på mount (autoritativ init).
    const { result } = renderHook(() => useFormPersistence(), { wrapper: FormPersistenceProvider });
    const fp = buildCellInvalidDraftFieldPath(TABLE_ID, '', 'deleted-row:3');
    seedDraft(fp, 'abc');

    // BUG-dokumentation: gaten blokerer på den forældreløse draft (spøgelses-mål, intet synligt felt).
    const blocked = getFirstBlockingInputErrorTarget(getFieldErrorsBySourceSnapshot, getInvalidDraftsForSectionSnapshot);
    expect(blocked).not.toBeNull();
    expect(blocked?.fieldName).toBe(fp);

    // Reconcile via context-primitivet (samme sti hook'en bruger): row 'deleted-row' lever ikke længere.
    act(() => {
      result.current.reconcileInvalidDrafts(PAGE_KEY, (candidate) =>
        isCellInvalidDraftRowOrphan(candidate, TABLE_ID, '', new Set())
      );
    });

    expect(drafts()[fp]).toBeUndefined();
    const after = getFirstBlockingInputErrorTarget(getFieldErrorsBySourceSnapshot, getInvalidDraftsForSectionSnapshot);
    expect(after).toBeNull();
  });

  it('af-scope reconcile rydder et slettet ansættelsesforholds drafts (eo-standardloen + eo-loenudvikling)', () => {
    const { result } = renderHook(() => useFormPersistence(), { wrapper: FormPersistenceProvider });
    const fpStd = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-dead', 'r1:2');
    const fpLoen = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoLoenudvikling, 'af-dead', 'r1:0');
    const fpAlive = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-alive', 'r1:2');
    seedDraft(fpStd, '12');
    seedDraft(fpLoen, '34');
    seedDraft(fpAlive, '56');

    act(() => {
      result.current.reconcileInvalidDrafts(PAGE_KEY, (candidate) =>
        isCellInvalidDraftScopeOrphan(candidate, [CELL_TABLE_IDS.eoStandardLoen, CELL_TABLE_IDS.eoLoenudvikling], new Set(['af-alive']))
      );
    });

    expect(drafts()[fpStd]).toBeUndefined();
    expect(drafts()[fpLoen]).toBeUndefined();
    expect(drafts()[fpAlive]).toBe('56'); // levende af urørt
  });
});

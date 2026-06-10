import * as React from 'react';
// Infrastruktur-hook: importerer FormPersistenceContext direkte (som useFormPersistence) for at kunne
// degradere context-frit til ubunden adfærd uden at kaste, når en tabel rendres uden provider (tests).
import { FormPersistenceContext } from '../../contexts/FormPersistenceContext.internal';
import { CellInvalidDraftScopeContext } from '../../contexts/CellInvalidDraftScopeContext';
import { buildCellInvalidDraftFieldPath } from '../../config/cellInvalidDraftScopes';
import { useInvalidDraftForFieldSelector } from '../useFormPersistenceSelectors';
import { createActiveTabStorageKey } from '../../config/storageManifest';
import { readOptionalSessionStorageValue } from '../../utils/safeSessionStorage';
import type { HistoryFrameOrigin } from '../../stores/undoRedoStore';
import type { StorageKey } from '../../config/storageManifest';

export type CellInvalidDraftChannel = Readonly<{
  /** Fuldt kvalificeret `fieldPath` for cellen, eller `undefined` når cellen er ubunden (uden scope/provider). */
  fieldPath: string | undefined;
  /** Reaktiv læsning af cellens committede rå draft (`invalidDrafts`). `undefined` når ubunden. */
  committedInvalidDraft: string | undefined;
  /** Skriv cellens ikke-committbare rå draft. `undefined` når ubunden. */
  onCommitInvalid: ((rawDraft: string) => void) | undefined;
  /** Ryd cellens rå draft (vellykket commit). `undefined` når ubunden. */
  clearInvalidDraft: (() => void) | undefined;
}>;

/**
 * Undo/redo-oprindelse for en celle-invalidDraft-commit. `fieldPath` her er den DOM-stabile
 * `gridCellKey` (svarer til `data-mineo-undo-field-path`), så undo lander fokus på cellen — adskilt
 * fra storage-`fieldPath` (fuldt kvalificeret), der ejes af `invalidDrafts`-nøglen.
 */
const buildCellUndoOrigin = (pageKey: StorageKey, gridCellKey: string): HistoryFrameOrigin => {
  const route = typeof window !== 'undefined' ? window.location.pathname : '/';
  const pageId = route.replace(/^\/+/, '') || 'stamdata';
  return {
    route,
    tabKey: readOptionalSessionStorageValue(createActiveTabStorageKey(pageId)),
    sectionKey: pageKey,
    fieldPath: gridCellKey,
    focusToken: null,
  };
};

/**
 * Celle-side binding til `invalidDrafts`-recovery-kanalen (parallel til `useFieldInvalidDraftChannel`
 * for almindelige felter).
 *
 * Kaldes ubetinget af `useTableInputCore` med cellens `gridCellKey`. Når både scope (feature-tabellen
 * leverer `CellInvalidDraftScopeProvider`) OG `FormPersistenceContext` er til stede, er kanalen bundet:
 * den udleder en fuldt kvalificeret `fieldPath`, læser/skriver `invalidDrafts` og opretter en
 * undo/redo-frame ved nyt ugyldigt input. Ellers er alle kanaler `undefined` (ubundet — lokal
 * fallback i `useTableInputCore`).
 */
export const useCellInvalidDraftChannel = (gridCellKey: string): CellInvalidDraftChannel => {
  const scope = React.useContext(CellInvalidDraftScopeContext);
  const persistence = React.useContext(FormPersistenceContext);
  const bound = scope !== null && persistence !== null;

  const fieldPath = scope !== null ? buildCellInvalidDraftFieldPath(scope.tableId, scope.rowScope, gridCellKey) : undefined;

  // useInvalidDraftForFieldSelector tolererer undefined-binding (returnerer da undefined) — sikker ubetinget kald.
  const committedInvalidDraft = useInvalidDraftForFieldSelector(scope?.pageKey, fieldPath);

  const onCommitInvalid = React.useCallback(
    (rawDraft: string) => {
      if (scope === null || persistence === null || fieldPath === undefined) return;
      persistence.commitInvalidDraft(scope.pageKey, fieldPath, rawDraft, {
        undoOrigin: buildCellUndoOrigin(scope.pageKey, gridCellKey),
      });
    },
    [scope, persistence, fieldPath, gridCellKey]
  );

  const clearInvalidDraft = React.useCallback(() => {
    if (scope === null || persistence === null || fieldPath === undefined) return;
    persistence.clearInvalidDraft(scope.pageKey, fieldPath);
  }, [scope, persistence, fieldPath]);

  return {
    fieldPath: bound ? fieldPath : undefined,
    committedInvalidDraft: bound ? committedInvalidDraft : undefined,
    onCommitInvalid: bound ? onCommitInvalid : undefined,
    clearInvalidDraft: bound ? clearInvalidDraft : undefined,
  };
};

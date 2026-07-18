import * as React from 'react';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import { useCollectionRows } from '../../inputCore/react/useCollectionRows';
import type { CellSpec } from '../../inputCore/react/useCellEditor';

export type GreenfieldRenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;
const NO_FIELD_OWNER_IDS: readonly string[] = Object.freeze([]);

/**
 * Fælles række-/placeholderbinding for greenfield-tabeller. Hooken holder kun UI-identiteten for den tomme
 * placeholder; alle eksisterende række-id'er og celleværdier kommer fra inputaggregatet.
 */
export const useGreenfieldCollectionTable = <TRow extends Readonly<{ id: string }>>({
  collection,
  committedRows,
  createRowId,
  createEmptyRow,
  locationPrefix,
  fieldOwnerIds = NO_FIELD_OWNER_IDS,
}: Readonly<{
  collection: CollectionRef;
  committedRows: readonly TRow[];
  createRowId: () => string;
  createEmptyRow: (id: string) => TRow;
  locationPrefix: string;
  /** Eventuelle ejer-id'er før række-id'et, fx ansættelsesforholdets id i nested EO-tabeller. */
  fieldOwnerIds?: readonly string[];
}>) => {
  const rows = useCollectionRows<TRow>(collection);
  const committedIdSet = React.useMemo(() => new Set(committedRows.map((row) => row.id)), [committedRows]);
  const placeholderIdRef = React.useRef<string | undefined>(undefined);
  const placeholderId = React.useMemo(() => {
    let id = placeholderIdRef.current;
    if (id === undefined || committedIdSet.has(id)) {
      id = createRowId();
      placeholderIdRef.current = id;
    }
    return id;
  }, [committedIdSet, createRowId]);

  const renderRows = React.useMemo<readonly GreenfieldRenderRow[]>(() => [
    ...committedRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
    { rowId: placeholderId, kind: 'placeholder' as const },
  ], [committedRows, placeholderId]);
  const committedById = React.useMemo(
    () => new Map(committedRows.map((row) => [row.id, row])),
    [committedRows]
  );

  const buildCellSpec = React.useCallback(<T,>(
    renderRow: GreenfieldRenderRow,
    descriptor: FieldDescriptor<T>,
    colIndex: number
  ): CellSpec<T, TRow> => {
    const location = { locationId: `${locationPrefix}:${renderRow.rowId}:${String(colIndex)}` };
    if (renderRow.kind === 'existing') {
      const field: FieldRef<T> = descriptor.bind(...fieldOwnerIds, renderRow.rowId);
      return { kind: 'existing', field, location };
    }
    return {
      kind: 'placeholder',
      descriptor,
      collection,
      entity: createEmptyRow(renderRow.rowId),
      entityId: renderRow.rowId,
      location,
    };
  }, [collection, createEmptyRow, fieldOwnerIds, locationPrefix]);

  return React.useMemo(() => ({
    renderRows,
    committedById,
    buildCellSpec,
    removeRow: rows.remove,
    reorderRows: rows.reorder,
  }), [buildCellSpec, committedById, renderRows, rows.remove, rows.reorder]);
};

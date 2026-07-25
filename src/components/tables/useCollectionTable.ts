import * as React from 'react';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import { useCollectionRowCommands } from '../../inputCore/react/useCollectionRows';
import type { CellSpec } from '../../inputCore/react/useCellEditor';

export type RenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;
const NO_FIELD_OWNER_IDS: readonly string[] = Object.freeze([]);

/**
 * Fælles række-/placeholderbinding for greenfield-tabeller. Hooken holder kun UI-identiteten for den tomme
 * placeholder; alle eksisterende række-id'er og celleværdier kommer fra inputaggregatet.
 */
export const useCollectionTable = <TRow extends Readonly<{ id: string }>>({
  collection,
  committedRows,
  createRowId,
  createEmptyRow,
  locationPrefix,
  locationNav,
  fieldOwnerIds = NO_FIELD_OWNER_IDS,
}: Readonly<{
  collection: CollectionRef;
  committedRows: readonly TRow[];
  createRowId: () => string;
  createEmptyRow: (id: string) => TRow;
  locationPrefix: string;
  /**
   * Eksplicit navigation-metadata for cellernes editorlokationer (§3.7): route + fane for den side/fane, tabellen
   * bor på. Kalderen leverer den, fordi tabellen ikke kan udlede route af `locationPrefix`.
   *
   * PÅKRÆVET — både feltet og `route`. Var de valgfrie, kunne en ny tabel lydløst få rækkehandlinger uden
   * destination: dataene ville blive gendannet ved undo, men brugeren ville blive efterladt på en vilkårlig side
   * (§3.7). `tabKey: null` udtrykker eksplicit "siden har ingen faner"; udeladelse er ikke længere lovlig.
   */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;
  /** Eventuelle ejer-id'er før række-id'et, fx ansættelsesforholdets id i nested EO-tabeller. */
  fieldOwnerIds?: readonly string[];
}>) => {
  // KUN rækkekommandoerne: rækkerne kommer fra slice-projektionens `committedRows` (den kanoniske read-grænse),
  // så tabellen må ikke også abonnere på collectionens aggregat-id-liste — det ville være to reaktive
  // rækkekilder for samme collection. Kommandoerne bærer tabellens origin, så undo/redo af en rækkehandling
  // navigerer til den rette side/fane (§3.7).
  const rows = useCollectionRowCommands<TRow>(collection, {
    locationId: locationPrefix,
    route: locationNav.route,
    tabKey: locationNav.tabKey,
  });
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

  const renderRows = React.useMemo<readonly RenderRow[]>(() => [
    ...committedRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
    { rowId: placeholderId, kind: 'placeholder' as const },
  ], [committedRows, placeholderId]);
  const committedById = React.useMemo(
    () => new Map(committedRows.map((row) => [row.id, row])),
    [committedRows]
  );

  const buildCellSpec = React.useCallback(<T,>(
    renderRow: RenderRow,
    descriptor: FieldDescriptor<T>,
    colIndex: number
  ): CellSpec<T, TRow> => {
    // route/tabKey er eksplicit navigation-metadata (§3.7) leveret af kalderen.
    const location = {
      locationId: `${locationPrefix}:${renderRow.rowId}:${String(colIndex)}`,
      route: locationNav.route,
      tabKey: locationNav.tabKey,
    };
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
  }, [collection, createEmptyRow, fieldOwnerIds, locationPrefix, locationNav]);

  return React.useMemo(() => ({
    renderRows,
    committedById,
    buildCellSpec,
    removeRow: rows.remove,
    reorderRows: rows.reorder,
  }), [buildCellSpec, committedById, renderRows, rows.remove, rows.reorder]);
};

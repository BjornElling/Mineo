import * as React from 'react';
import {
  bindSortableHeader,
  useTableSort,
  type SortableHeaderProps,
  type TableSortColumn,
  type UseTableSortResult,
} from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

/**
 * Rækkefølge-laget for en sorterbar samlingstabel: sortering, persistering af den nye orden,
 * save-order-registreringen og — for de tabeller der har en separat render-model —
 * render-rækkefølgen, som ÉN enhed.
 *
 * Tingene hører sammen og skal altid følges: sorterer brugeren, skal den nye orden
 * persisteres i samme event, render-rækkefølgen følge med, og save-order-registret se
 * præcis den rækkefølge, brugeren ser. Blev de skrevet hver for sig pr. tabel — som de var
 * — kunne en ny tabel få tre af fire rigtigt, og fejlen ville først vise sig som en gemt
 * fil med en anden rækkefølge end skærmen.
 *
 * `renderRows` er valgfri, fordi tabellerne deler sig i to reelle arter, ikke af
 * bekvemmelighed: de der bygger deres render-rækker via `useCollectionTable` (en separat
 * model, der skal reconciles mod den sorterede orden) og de der bygger dem DIREKTE fra de
 * sorterede rækker plus placeholder-slot-id'er (ingen reconciliation at lave — orden er
 * allerede rigtig). Udelades feltet, springes reconciliationen over frem for at lave en
 * identitets-operation, hvis fravær ellers ville se ud som et glemt argument.
 *
 * Bevidst afgrænsning: dette er IKKE en kolonnespec. De to tabel-shells har uforenelige
 * bredde-API'er (`<colgroup>` + `tableWidth` vs. `sx` på header-celler), kolonneindeks er
 * ikke 1:1 med visuelle kolonner (én tabel mapper tre feltnøgler til ét indeks), og
 * celle-renderne er ikke uniforme. En fælles spec ville derfor kræve escape-hatches for
 * flertallet af tabellerne. Rækkefølgen er den del, der ER ens overalt.
 */

/**
 * En render-række fra grid-modellen. Kun de felter rækkefølge-laget selv læser er krævet,
 * så hooken kan bruges af begge shells uden at kende deres celle-typer.
 */
type RenderRowLike = Readonly<{ rowId: string; kind: string }>;

export type UseSortedCollectionTableResult<TRow, TRenderRow> = UseTableSortResult<TRow> & Readonly<{
  /**
   * Render-rækkerne i den sorterede orden, med en eventuel placeholder-række sidst.
   * Placeholderen holdes altid i bunden: den er «næste tomme række», ikke data, og skal
   * ikke kunne sorteres ind mellem de udfyldte rækker.
   *
   * Tom, når kalderen ikke har en separat render-model (se modul-doc).
   */
  renderRows: readonly TRenderRow[];
  /** Rækkefølgen af række-id'er, som save-order-registret har fået. */
  sortedRowIds: readonly string[];
  /** Bind en header-celles sorterings-props i ét kald. Se {@link bindSortableHeader}. */
  sortableHeader: (colId: string) => SortableHeaderProps;
}>;

export const useSortedCollectionTable = <TRow, TRenderRow extends RenderRowLike>({
  committedRows,
  renderRows,
  getRowId,
  isRowEmpty,
  columns,
  reorderRows,
  saveOrderPath,
}: Readonly<{
  committedRows: readonly TRow[];
  /**
   * Grid-modellens render-rækker (udfyldte + evt. placeholder), i modellens egen orden.
   * Udelades af de tabeller, der bygger deres render-rækker direkte fra den sorterede orden.
   */
  renderRows?: readonly TRenderRow[];
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  columns: readonly TableSortColumn<TRow>[];
  /** Persistér den nye rækkefølge. Kaldes i samme event som headerklikket. */
  reorderRows: (rowIds: readonly string[]) => void;
  saveOrderPath: TableSaveOrderPath | undefined;
}>): UseSortedCollectionTableResult<TRow, TRenderRow> => {
  const handleSortedRowsChange = React.useCallback(
    (sorted: readonly TRow[]) => {
      reorderRows(sorted.map(getRowId));
    },
    [getRowId, reorderRows]
  );

  const sort = useTableSort({
    rows: committedRows,
    getRowId,
    isRowEmpty,
    columns,
    onSortedRowsChange: handleSortedRowsChange,
  });

  const orderedRenderRows = React.useMemo(() => {
    if (renderRows === undefined) return [];
    const byRowId = new Map(renderRows.map((row) => [row.rowId, row]));
    const placeholder = renderRows.find((row) => row.kind === 'placeholder');
    return [
      ...sort.sortedRows
        .map((row) => byRowId.get(getRowId(row)))
        .filter((row): row is TRenderRow => row !== undefined),
      ...(placeholder === undefined ? [] : [placeholder]),
    ];
  }, [getRowId, renderRows, sort.sortedRows]);

  const sortedRowIds = React.useMemo(() => sort.sortedRows.map(getRowId), [getRowId, sort.sortedRows]);
  useRegisterTableSaveOrder(saveOrderPath, sortedRowIds);

  const sortableHeader = React.useCallback((colId: string) => bindSortableHeader(sort, colId), [sort]);

  return { ...sort, renderRows: orderedRenderRows, sortedRowIds, sortableHeader };
};

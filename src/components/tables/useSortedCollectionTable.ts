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
import type { CollectionRef } from '../../inputCore/fieldAddress';
import { useInputEditPort } from '../../inputCore/react/inputRuntimeContext';

/** Afgrænset capability til sorterbare tabeller; andre collection-tabeller får den ikke gennem `useCollectionTable`. */
export const usePersistSortedCollectionOrder = (collection: CollectionRef) => {
  const { persistSortedOrder } = useInputEditPort();
  return React.useCallback(
    (rowIds: readonly string[]) => persistSortedOrder(collection, rowIds),
    [collection, persistSortedOrder]
  );
};

/**
 * Rækkefølge-laget for en sorterbar samlingstabel: sortering, persistens af den nye orden,
 * save-order-registreringen og header-bindingen, som ÉN enhed.
 *
 * Tingene hører sammen og skal altid følges: sorterer brugeren, skal den nye orden
 * persisteres i samme event, render-rækkefølgen følge med, og save-order-registret se
 * præcis den rækkefølge, brugeren ser. Blev de skrevet hver for sig pr. tabel – som de var
 * – kunne en ny tabel få tre af fire rigtigt, og fejlen ville først vise sig som en gemt
 * fil med en anden rækkefølge end skærmen.
 *
 * Hooken bygger IKKE selv render-rækker. Den leverer `sortedRows`, som kalderen giver videre
 * til `useCollectionTable` som `displayRows`; dér bygges render-modellen ét sted, af den
 * orden rækkerne skal vises i. Tidligere gjorde hooken begge dele: den tog en færdigbygget
 * render-model i modellens EGEN orden og permuterede den tilbage på plads. Den vej er væk,
 * fordi den var en omvej til samme resultat – og fordi den kun kunne genfinde ÉN placeholder
 * (`.find`), så en tabel med flere tomme rækker tavst tabte dem.
 *
 * Bevidst afgrænsning: dette er IKKE en kolonnespec. De to tabel-shells har uforenelige
 * bredde-API'er (`<colgroup>` + `tableWidth` vs. `sx` på header-celler), kolonneindeks er
 * ikke 1:1 med visuelle kolonner (én tabel mapper tre feltnøgler til ét indeks), og
 * celle-renderne er ikke uniforme. En fælles spec ville derfor kræve escape-hatches for
 * flertallet af tabellerne. Rækkefølgen er den del, der ER ens overalt.
 */

export type UseSortedCollectionTableResult<TRow> = UseTableSortResult<TRow> & Readonly<{
  /** Rækkefølgen af række-id'er, som save-order-registret har fået. */
  sortedRowIds: readonly string[];
  /** Bind en header-celles sorterings-props i ét kald. Se {@link bindSortableHeader}. */
  sortableHeader: (colId: string) => SortableHeaderProps;
}>;

export const useSortedCollectionTable = <TRow>({
  committedRows,
  getRowId,
  isRowEmpty,
  columns,
  persistSortedOrder,
  saveOrderPath,
}: Readonly<{
  committedRows: readonly TRow[];
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  columns: readonly TableSortColumn<TRow>[];
  /** Persistér sorteringen uden at gøre den til et undo-trin. Kaldes i samme event som headerklikket. */
  persistSortedOrder: (rowIds: readonly string[]) => void;
  saveOrderPath: TableSaveOrderPath | undefined;
}>): UseSortedCollectionTableResult<TRow> => {
  const handleSortedRowsChange = React.useCallback(
    (sorted: readonly TRow[]) => {
      persistSortedOrder(sorted.map(getRowId));
    },
    [getRowId, persistSortedOrder]
  );

  const sort = useTableSort({
    rows: committedRows,
    getRowId,
    isRowEmpty,
    columns,
    onSortedRowsChange: handleSortedRowsChange,
  });

  const sortedRowIds = React.useMemo(() => sort.sortedRows.map(getRowId), [getRowId, sort.sortedRows]);
  useRegisterTableSaveOrder(saveOrderPath, sortedRowIds);

  const sortableHeader = React.useCallback((colId: string) => bindSortableHeader(sort, colId), [sort]);

  return { ...sort, sortedRowIds, sortableHeader };
};

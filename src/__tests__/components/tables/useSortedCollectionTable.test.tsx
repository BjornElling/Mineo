// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useSortedCollectionTable } from '../../../components/tables/useSortedCollectionTable';
import { bindSortableHeader, useTableSort } from '../../../components/tables/useTableSort';
import {
  applyRegisteredTableSaveOrder,
  clearTableSaveOrderRegistryForTests,
} from '../../../utils/tableSaveOrderRegistry';
import type { TableSaveOrderPath } from '../../../utils/tableSaveOrderRegistry';

/**
 * Rækkefølge-lagets fire koblede egenskaber (sortering, reorder-persistering,
 * render-rækkefølge, save-order-registrering) hævdes her ÉT sted.
 *
 * Grunden til at de skal testes sammen: de var skrevet i hånden pr. tabel, og en tabel kunne
 * få tre af fire rigtigt. Særligt save-order/render-order-koblingen fejler tavst — brugeren
 * ser én rækkefølge, den gemte fil får en anden, og hverken typecheck eller en render-test
 * bemærker det.
 */

type Row = Readonly<{ id: string; navn: string; tal: number }>;
type RenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;

const rows: readonly Row[] = [
  { id: 'b', navn: 'Bertha', tal: 2 },
  { id: 'a', navn: 'Anton', tal: 3 },
  { id: 'c', navn: 'Cecilie', tal: 1 },
];

const columns = [
  { colId: 'navn', getSortValue: (row: Row) => row.navn },
  { colId: 'tal', getSortValue: (row: Row) => row.tal },
];

const getRowId = (row: Row) => row.id;
const isRowEmpty = (row: Row) => row.navn === '' && row.tal === 0;

/** Render-modellen i sin EGEN (usorterede) orden, med placeholderen i midten. */
const modelRenderRows: readonly RenderRow[] = [
  { rowId: 'b', kind: 'existing' },
  { rowId: 'placeholder-1', kind: 'placeholder' },
  { rowId: 'a', kind: 'existing' },
  { rowId: 'c', kind: 'existing' },
];

// En RIGTIG registry-sti: registret validerer rodnøglen mod storage-manifestet, så en
// opdigtet sti ville blive afvist med en console.error og gøre save-order-testene grønne af
// tomhed.
const SAVE_ORDER_PATH: TableSaveOrderPath = 'erstatningsopgoerelse.svieSmertePerioder';

/** Læs den registrerede orden ud gennem den vej, gemmefunktionen faktisk bruger. */
const readRegisteredOrder = (): readonly string[] => {
  const snapshot = applyRegisteredTableSaveOrder({
    erstatningsopgoerelse: { svieSmertePerioder: rows.map((row) => ({ id: row.id })) },
  } as never) as never as Readonly<{
    erstatningsopgoerelse: Readonly<{ svieSmertePerioder: readonly Readonly<{ id: string }>[] }>;
  }>;
  return snapshot.erstatningsopgoerelse.svieSmertePerioder.map((row) => row.id);
};

type HarnessProps = Readonly<{
  reorderRows: (ids: readonly string[]) => void;
  withRenderRows?: boolean;
  saveOrderPath?: TableSaveOrderPath;
}>;

const Harness = ({ reorderRows, withRenderRows = true, saveOrderPath = SAVE_ORDER_PATH }: HarnessProps) => {
  const memoColumns = React.useMemo(() => columns, []);
  const result = useSortedCollectionTable<Row, RenderRow>({
    committedRows: rows,
    renderRows: withRenderRows ? modelRenderRows : undefined,
    getRowId,
    isRowEmpty,
    columns: memoColumns,
    reorderRows,
    saveOrderPath,
  });

  return (
    <div>
      <button type="button" data-testid="sort-navn" {...result.sortableHeader('navn')}>
        navn
      </button>
      <span data-testid="sort-role">{result.sortableHeader('navn').sortRole}</span>
      <span data-testid="sort-direction">{String(result.sortableHeader('navn').sortDirection)}</span>
      <span data-testid="sorted-ids">{result.sortedRows.map(getRowId).join(',')}</span>
      <span data-testid="render-ids">{result.renderRows.map((row) => row.rowId).join(',')}</span>
      <span data-testid="registered-ids">{result.sortedRowIds.join(',')}</span>
    </div>
  );
};

describe('useSortedCollectionTable', () => {
  beforeEach(clearTableSaveOrderRegistryForTests);
  afterEach(clearTableSaveOrderRegistryForTests);

  it('render-rækkerne følger den sorterede orden, og placeholderen holdes i bunden', async () => {
    render(<Harness reorderRows={() => {}} />);

    // Usorteret: modellens egen orden for de udfyldte rækker, placeholder sidst.
    // Placeholderen stod i MIDTEN i modellen — den må ikke kunne sorteres ind mellem data.
    expect(screen.getByTestId('render-ids').textContent).toBe('b,a,c,placeholder-1');

    await act(async () => {
      screen.getByTestId('sort-navn').click();
    });

    expect(screen.getByTestId('sorted-ids').textContent).toBe('a,b,c');
    expect(screen.getByTestId('render-ids').textContent).toBe('a,b,c,placeholder-1');
  });

  it('persisterer den nye orden i SAMME event som headerklikket', async () => {
    // Kravet er ikke kosmetisk: en save/download i samme task må aldrig kunne se den gamle
    // orden, mens tabellen allerede viser den nye.
    const reorderCalls: readonly string[][] = [];
    const reorderRows = (ids: readonly string[]) => {
      (reorderCalls as string[][]).push([...ids]);
    };
    render(<Harness reorderRows={reorderRows} />);

    await act(async () => {
      screen.getByTestId('sort-navn').click();
    });

    expect(reorderCalls).toEqual([['a', 'b', 'c']]);
  });

  it('registrerer save-order i den rækkefølge brugeren ser', async () => {
    render(<Harness reorderRows={() => {}} />);

    expect(readRegisteredOrder()).toEqual(['b', 'a', 'c']);

    await act(async () => {
      screen.getByTestId('sort-navn').click();
    });

    // Både det viste og det registrerede skal have flyttet sig — ikke kun det viste.
    expect(screen.getByTestId('render-ids').textContent).toBe('a,b,c,placeholder-1');
    expect(readRegisteredOrder()).toEqual(['a', 'b', 'c']);
  });

  it('springer render-reconciliation over, når kalderen ikke har en separat render-model', () => {
    // De tabeller, der bygger render-rækkerne direkte fra den sorterede orden, har intet at
    // reconcile. Fraværet skal give en tom liste, ikke et forsøg på at slå op i undefined.
    render(<Harness reorderRows={() => {}} withRenderRows={false} />);

    expect(screen.getByTestId('render-ids').textContent).toBe('');
    expect(screen.getByTestId('sorted-ids').textContent).toBe('b,a,c');
    expect(screen.getByTestId('registered-ids').textContent).toBe('b,a,c');
  });

  it('sortableHeader giver alle tre props fra ét colId', async () => {
    render(<Harness reorderRows={() => {}} />);

    expect(screen.getByTestId('sort-role').textContent).toBe('none');

    await act(async () => {
      screen.getByTestId('sort-navn').click();
    });

    expect(screen.getByTestId('sort-role').textContent).toBe('primary');
    expect(screen.getByTestId('sort-direction').textContent).toBe('asc');
  });
});

describe('bindSortableHeader', () => {
  it('binder onClick/sortRole/sortDirection til ét og samme colId', async () => {
    // Beviser at den frie funktion — som de base-række-ankrede tabeller bruger — giver samme
    // binding som hookens `sortableHeader`. Ellers kunne de to drive fra hinanden.
    const Direct = () => {
      const memoColumns = React.useMemo(() => columns, []);
      const sort = useTableSort({ rows, getRowId, isRowEmpty, columns: memoColumns });
      const bound = bindSortableHeader(sort, 'tal');
      return (
        <div>
          <button type="button" data-testid="sort-tal" {...bound}>tal</button>
          <span data-testid="role">{bound.sortRole}</span>
          <span data-testid="ids">{sort.sortedRows.map(getRowId).join(',')}</span>
        </div>
      );
    };

    render(<Direct />);
    expect(screen.getByTestId('role').textContent).toBe('none');

    await act(async () => {
      screen.getByTestId('sort-tal').click();
    });

    expect(screen.getByTestId('role').textContent).toBe('primary');
    expect(screen.getByTestId('ids').textContent).toBe('c,b,a');
  });
});

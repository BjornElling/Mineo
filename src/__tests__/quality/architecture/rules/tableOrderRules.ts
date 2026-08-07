/**
 * Ejerskabet af en sorterbar tabels RÆKKEFØLGE.
 *
 * Fire ting skal altid følges, når brugeren sorterer: den nye orden persisteres i samme
 * event, render-rækkefølgen følger med, save-order-registret ser præcis den orden brugeren
 * ser, og header-cellen viser sin sorteringspil. De var skrevet i hånden pr. tabel — ordret
 * ens i 7-8 af de 10 — så en ny tabel kunne få tre af fire rigtigt. Fejlen ville først vise
 * sig som en gemt fil med en anden rækkefølge end skærmen: ingen typefejl, ingen exception.
 *
 * Reglen håndhæver derfor, at en tabel der sorterer og har en save-order-sti, får sin
 * rækkefølge fra `useSortedCollectionTable` frem for at kalde `useRegisterTableSaveOrder`
 * selv. Undtagelsen er de to base-række-ankrede tabeller, hvis reorder-semantik er en anden
 * (den programstyrede basisrække skal forblive på plads); de er navngivet nedenfor og
 * registrerer bevidst ingen save-order.
 */
import { defineRule } from '../ruleKit';
import { collectCalls } from '../astQueries';

const TABLE_SCOPE = 'src/components/tables/';

const isTopLevelTable = (relativePath: string): boolean =>
  relativePath.startsWith(TABLE_SCOPE)
  && !relativePath.slice(TABLE_SCOPE.length).includes('/')
  && relativePath.endsWith('Table.tsx');

/**
 * Tabellerne hvis rækkefølge ejes af `useSortedCollectionTable`.
 *
 * De to `Loenudvikling*`-tabeller står bevidst IKKE her: deres reorder ankrer den
 * programstyrede basisrække på plads, og de registrerer ingen save-order. De deler kun
 * `bindSortableHeader` med de øvrige.
 */
const SORTED_ORDER_OWNED_TABLES = [
  'BeregnetRenteTable.tsx',
  'EetAslAfgoerelserTable.tsx',
  'FerieperiodeTable.tsx',
  'OevrigeKravTable.tsx',
  'OffentligeYdelserTable.tsx',
  'StandardLoenTable.tsx',
  'SvieSmerteTable.tsx',
  'TafPeriodeTable.tsx',
].map((name) => `${TABLE_SCOPE}${name}`);

export const tableSortOrderOwnershipRule = defineRule({
  id: 'form/table-sort-order-owned-by-hook',
  description:
    'En sorterbar tabel må ikke kalde useRegisterTableSaveOrder selv — rækkefølgen (sortering, reorder-persistering, render-orden, save-order) ejes af useSortedCollectionTable.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => collectCalls(entry).some((call) => call.calleeName === 'useSortedCollectionTable'),
    rationale:
      'reglen forudsætter, at de sorterbare samlingstabeller stadig får deres rækkefølge fra den fælles hook; '
      + 'holder de op, er der ingen fælles ejer at håndhæve',
    minimumMatches: SORTED_ORDER_OWNED_TABLES.length,
    requiredPaths: SORTED_ORDER_OWNED_TABLES,
  },
  appliesTo: isTopLevelTable,
  find: (entry) => {
    const calls = collectCalls(entry);
    const handWired = calls.filter((call) => call.calleeName === 'useRegisterTableSaveOrder');
    if (handWired.length === 0) return [];
    return handWired.map((call) => ({
      position: call.position,
      message:
        'Tabellen registrerer sin save-order i hånden. Brug useSortedCollectionTable, så sortering, '
        + 'reorder-persistering, render-rækkefølge og save-order ikke kan komme ud af sync.',
    }));
  },
  violatingFixtures: [{
    relativePath: `${TABLE_SCOPE}XTable.tsx`,
    code:
      'const sort = useTableSort({ rows, columns });\n'
      + 'useRegisterTableSaveOrder(saveOrderPath, sort.sortedRows.map((r) => r.id));',
  }],
  cleanFixtures: [
    {
      relativePath: `${TABLE_SCOPE}XTable.tsx`,
      code: 'const { renderRows, sortableHeader } = useSortedCollectionTable({ committedRows, columns, saveOrderPath });',
    },
    // De base-række-ankrede tabeller bruger useTableSort direkte og registrerer INGEN
    // save-order. Den form må reglen ikke fælde.
    {
      relativePath: `${TABLE_SCOPE}LoenudviklingManuelTable.tsx`,
      code: 'const sort = useTableSort({ rows, columns, onSortedRowsChange: anchorBaseRow });',
    },
  ],
});

export const TABLE_ORDER_RULES = [tableSortOrderOwnershipRule] as const;

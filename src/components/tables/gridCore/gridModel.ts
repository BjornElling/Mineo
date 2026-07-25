export type GridSortDirection = 'asc' | 'desc';

export type GridSortState = Readonly<{
  primary?: Readonly<{ colId: string; dir: GridSortDirection }>;
  secondary?: Readonly<{ colId: string; dir: GridSortDirection }>;
}>;

export type GridSortRole = 'none' | 'primary' | 'secondary';

export const getGridSortRole = (state: GridSortState, colId: string): GridSortRole => {
  if (state.primary?.colId === colId) return 'primary';
  if (state.secondary?.colId === colId) return 'secondary';
  return 'none';
};

export const toggleGridSort = (state: GridSortState, colId: string): GridSortState => {
  const primary = state.primary;
  const secondary = state.secondary;

  if (primary?.colId === colId) {
    const nextDir: GridSortDirection = primary.dir === 'asc' ? 'desc' : 'asc';
    return { primary: { colId, dir: nextDir }, secondary };
  }

  // Ny primær sortering er altid stigende.
  // Den tidligere primære bliver sekundær (stabil sorterings-hukommelse).
  return {
    primary: { colId, dir: 'asc' },
    secondary: primary ? { colId: primary.colId, dir: primary.dir } : undefined,
  };
};

type GridSortValue = string | number | null | undefined;

export type GridSortValueGetter<TRow> = (row: TRow) => GridSortValue;

const isEmptySortValue = (value: GridSortValue): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  return value.trim() === '';
};

const compareSortValues = (a: GridSortValue, b: GridSortValue): number => {
  const aEmpty = isEmptySortValue(a);
  const bEmpty = isEmptySortValue(b);
  if (aEmpty && bEmpty) return 0;
  // Tomme værdier sorteres altid sidst (begge retninger håndteres ved fortegnsskift på callsite'et).
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;

  const aText = typeof a === 'string' ? a : String(a);
  const bText = typeof b === 'string' ? b : String(b);
  return aText.localeCompare(bText, 'da-DK');
};

export const sortGridRows = <TRow>(params: Readonly<{
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  sortState: GridSortState;
  getSortValueByColId: (colId: string) => GridSortValueGetter<TRow> | undefined;
}>): TRow[] => {
  const { rows, getRowId, isRowEmpty, sortState, getSortValueByColId } = params;

  const primary = sortState.primary;
  if (!primary) return [...rows];

  const nonEmptyRows: TRow[] = [];
  const emptyRows: TRow[] = [];
  for (const row of rows) {
    if (isRowEmpty(row)) emptyRows.push(row);
    else nonEmptyRows.push(row);
  }

  const insertionIndexByRowId = new Map<string, number>();
  for (let idx = 0; idx < rows.length; idx += 1) {
    insertionIndexByRowId.set(getRowId(rows[idx]), idx);
  }

  const primaryGetter = getSortValueByColId(primary.colId);
  const secondary = sortState.secondary;
  const secondaryGetter = secondary ? getSortValueByColId(secondary.colId) : undefined;

  const primaryDirSign = primary.dir === 'asc' ? 1 : -1;
  const secondaryDirSign = secondary && secondary.dir === 'asc' ? 1 : -1;

  const sorted = [...nonEmptyRows].sort((a, b) => {
    const primaryA = primaryGetter?.(a);
    const primaryB = primaryGetter?.(b);
    const primaryCmp = compareSortValues(primaryA, primaryB);
    if (primaryCmp !== 0) return primaryCmp * primaryDirSign;

    if (secondary && secondaryGetter) {
      const secondaryA = secondaryGetter(a);
      const secondaryB = secondaryGetter(b);
      const secondaryCmp = compareSortValues(secondaryA, secondaryB);
      if (secondaryCmp !== 0) return secondaryCmp * secondaryDirSign;
    }

    // insertionIndexByRowId er bygget fra de samme `rows`, så et lookup-miss kan kun ske ved et
    // brud på getRowId-determinismekontrakten. Fald tilbage på `rows.length` (sorterer manglende
    // sidst, deterministisk) i stedet for 0, der ville kollapse distinkte rækker til samme nøgle
    // og gøre comparatoren ustabil.
    const aIdx = insertionIndexByRowId.get(getRowId(a));
    const bIdx = insertionIndexByRowId.get(getRowId(b));
    if (import.meta.env.DEV && (aIdx === undefined || bIdx === undefined)) {
      throw new Error('sortGridRows: getRowId returnerede en ukendt id under sortering (ikke-deterministisk getRowId)');
    }
    return (aIdx ?? rows.length) - (bIdx ?? rows.length);
  });

  return [...sorted, ...emptyRows];
};

export type GridRowIdentityReconciliation<TRow> = Readonly<{
  rows: TRow[];
  undoAliasRowIdsByRowId: ReadonlyMap<string, readonly string[]>;
}>;

/**
 * Resynkronisér en grid-tabel fra committed state uden at omskrive persisted række-id'er.
 *
 * Tidligere graftede vi `current[i].id` direkte ind i `incoming[i].id` for at redde undo-fokus, når
 * en række skiftede mellem udfyldt og tom. Det gjorde `row.id` til både datanøgle og UI-alias. I
 * tabeller med afledte/locked celler (fx Offentlige ydelser) slog forælderen derefter stadig afledte
 * værdier op på committed id, mens tabellen renderede et graftet id, og cellerne blev tomme.
 *
 * Reglen er derfor:
 * - Ikke-tomme incoming-rækker beholder ALTID deres committed id.
 * - Tomme syntetiske rækker må arve et tidligere id, fordi de ikke persisteres som brugerdata.
 * - Hvor et ikke-tomt id ikke kan graftes, oprettes i stedet et undo-fokus-alias (`oldId -> row.id`).
 *
 * Aliaset er kun til `data-mineo-undo-field-path`-restore. Validering, beregning, sortering og
 * persistering bruger fortsat den faktiske række-id.
 */
export const reconcileGridRowIdentityForRestore = <TRow>(params: Readonly<{
  incoming: readonly TRow[];
  current: readonly TRow[];
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  withRowId: (row: TRow, id: string) => TRow;
}>): GridRowIdentityReconciliation<TRow> => {
  const { incoming, current, getRowId, isRowEmpty, withRowId } = params;

  // Hvert incoming-id er reserveret til sin egen række — et graft må aldrig overtage det.
  const incomingIds = new Set<string>(incoming.map(getRowId));
  const usedTransferredIds = new Set<string>();
  const undoAliasRowIdsByRowId = new Map<string, string[]>();

  const rows = incoming.map((row, index) => {
    const currentRow = current[index];
    if (!currentRow) return row;
    const currentId = getRowId(currentRow);
    const incomingId = getRowId(row);
    if (currentId === incomingId) return row;
    // Hver incoming-række ejer sit id. Et tidligere id må kun flyttes/aliaseres, hvis det ikke
    // allerede findes som en rigtig incoming-række, ellers ville fokus-restore kunne ramme forkert.
    if (incomingIds.has(currentId)) return row;
    if (usedTransferredIds.has(currentId)) return row;
    usedTransferredIds.add(currentId);

    if (isRowEmpty(row)) {
      return withRowId(row, currentId);
    }

    const aliases = undoAliasRowIdsByRowId.get(incomingId) ?? [];
    aliases.push(currentId);
    undoAliasRowIdsByRowId.set(incomingId, aliases);
    return row;
  });

  return { rows, undoAliasRowIdsByRowId };
};

/**
 * Determinisme-kontrakt for `createEmptyRow`:
 *
 * `normalizeGridRows` kaldes typisk INDE i en React `setState`-updater. Under StrictMode (og
 * fremtidig concurrent rendering) dobbelt-invokeres updateren, så `normalizeGridRows` — og dermed
 * `createEmptyRow` — kører to gange for samme input. Hvis `createEmptyRow` genererede et tilfældigt
 * id (fx `crypto.randomUUID()`), ville de to kørsler producere FORSKELLIGE id'er. Tabeller der
 * gater persistering på et id-følsomt fingerprint ville så se de to resultater divergere og
 * springe persisteringen over → datatab (en ryddet celle blev aldrig gemt).
 *
 * Derfor SKAL `createEmptyRow` være ren: id'et udledes deterministisk af `seed`-argumentet, ikke af
 * en RNG. To kørsler med samme input giver da identiske rækker. De deterministiske id'er er bevidst
 * transiente — `reconcileGridRowIdentityForRestore` kan re-stabilisere tomme rækker ved næste
 * prop-resync, og fokus-systemet kan bruge separate aliaser uden at omskrive ikke-tomme data-id'er.
 *
 * `seed` er et monotont tal (0, 1, 2 …) pr. tom række oprettet i denne normalisering, så de
 * deterministiske id'er er unikke indbyrdes og ikke kolliderer.
 */
export const normalizeGridRows = <TRow>(params: Readonly<{
  rows: readonly TRow[];
  minRows: number;
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  createEmptyRow: (seed: number) => TRow;
}>): TRow[] => {
  const { rows, minRows, getRowId, isRowEmpty, createEmptyRow } = params;

  const usedRowIds = new Set(rows.map(getRowId));
  // Monotont seed pr. nyoprettet tom række. Seeds springes over, hvis deres deterministiske id
  // allerede findes i inputtet; ellers kan en persisteret trailing tom række (`*_empty_0`) kollidere
  // med den ekstra minRows-række og ødelægge React-/grid-identitet.
  let nextEmptyRowSeed = 0;
  const makeEmptyRow = (): TRow => {
    while (true) {
      const candidate = createEmptyRow(nextEmptyRowSeed++);
      const rowId = getRowId(candidate);
      if (usedRowIds.has(rowId)) continue;
      usedRowIds.add(rowId);
      return candidate;
    }
  };

  const existingTrailingEmpty = rows.length > 0 && isRowEmpty(rows[rows.length - 1]) ? rows[rows.length - 1] : null;
  const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));

  const normalized: TRow[] = [...nonEmptyRows];
  normalized.push(existingTrailingEmpty ?? makeEmptyRow());

  // Sikr minimum-rækketal, mens den efterfølgende tomme række holdes til sidst.
  const safeMinRows = Math.max(1, Math.trunc(minRows));
  while (normalized.length < safeMinRows) {
    normalized.splice(Math.max(0, normalized.length - 1), 0, makeEmptyRow());
  }

  return normalized;
};

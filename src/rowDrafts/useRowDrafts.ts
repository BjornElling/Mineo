import * as React from 'react';
import type { RowId, WithId } from './types';

/**
 * Celle-identitet for et commit, så undo/redo kan tagge history-framet med den celle
 * brugeren faktisk redigerede (fieldPath = `rowId:colIndex`). Uden den falder
 * `createUndoOrigin` tilbage på focus-trackeren, som ved blur peger på det *næste* felt.
 */
export type RowCommitOrigin = Readonly<{ fieldPath?: string }>;

export type UseRowDraftsConfig<
  TDraft extends WithId,
  TCommitted extends WithId,
  TField extends keyof TDraft & string = keyof TDraft & string,
> = {
  // 1) Access to committed state
  getCommitted: () => TCommitted[] | undefined;
  setCommitted: (
    updater: (prevRows: TCommitted[] | undefined) => TCommitted[] | undefined,
    origin?: RowCommitOrigin
  ) => void;

  // 2) Mapping between committed and draft
  toDraft: (rows: TCommitted[]) => TDraft[];
  toCommittedRow: (draft: TDraft, prevCommittedRow?: TCommitted) => TCommitted;

  // 3) Row-policy
  isRowEmpty: (row: TCommitted) => boolean;
  ensureRows: (rows: TCommitted[] | undefined) => TCommitted[];

  // 4) ID generation (used for addRow / empty init helpers)
  createId: () => RowId;
  createEmptyCommittedRow: (id: RowId) => TCommitted;

  /**
   * Felt → kolonneindeks, så et celle-commit kan tagges med `rowId:colIndex` —
   * samme identitet som Table*Input-cellerne registrerer deres draft-history-controller
   * under (`gridCell.colIndex`). Udelades den, falder undo-origin tilbage til focus-trackeren
   * (uændret tidligere adfærd).
   */
  fieldColIndex?: Readonly<Record<TField, number>>;

  // 5) Optional draft init when committed is empty/undefined
  initFromCommitted?: (rows: TCommitted[] | undefined) => TCommitted[];

  /**
   * Token der ændres når committed rows skal betragtes som authoritative
   * (fx reset, load, version-migration).
   *
   * VIGTIGT: Hooken resyncer ikke drafts ud fra "committed ændrede sig" alene.
   * Resync sker kun ved:
   * - initial mount (init fra committed)
   * - interne commits/add/remove (hooken selv)
   * - eksplicit ændring af resyncToken
   */
  resyncToken: unknown;
};

export type UseRowDraftsResult<TDraft extends WithId, TField extends keyof TDraft & string> = {
  draftRows: TDraft[];

  onFieldChange: (rowId: RowId, field: TField) => (value: string) => void;
  onRowBlur: (rowId: RowId) => void;

  commitRow: (rowId: RowId) => boolean;
  commitAll: () => boolean;

  addRow: () => void;
  removeRow: (rowId: RowId) => void;
  reorderRows: (orderedIds: readonly RowId[]) => void;
  resetDraftFromCommitted: () => void;
};

type EnsureRowsConfig<TCommitted extends WithId> = Pick<
  UseRowDraftsConfig<WithId, TCommitted>,
  'ensureRows' | 'initFromCommitted'
>;

const getEnsuredCommitted = <TCommitted extends WithId>(
  rows: TCommitted[] | undefined,
  config: EnsureRowsConfig<TCommitted>
): TCommitted[] => {
  return config.initFromCommitted?.(rows) ?? config.ensureRows(rows);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const committedValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && Object.is(left.getTime(), right.getTime());
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => committedValuesEqual(item, right[index]));
  }
  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined).sort();
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key, index) => key === rightKeys[index] && committedValuesEqual(left[key], right[key]));
  }
  return false;
};

const committedRowsEqual = <TCommitted extends WithId>(
  left: readonly TCommitted[],
  right: readonly TCommitted[]
): boolean => {
  return committedValuesEqual(left, right);
};

const reorderRowsByIds = <TRow extends WithId>(
  rows: readonly TRow[],
  orderedIds: readonly RowId[]
): TRow[] => {
  if (rows.length <= 1 || orderedIds.length <= 1) return [...rows];

  const rowById = new Map(rows.map((row) => [row.id, row] as const));
  const seen = new Set<RowId>();
  const reordered: TRow[] = [];

  for (const id of orderedIds) {
    const row = rowById.get(id);
    if (!row || seen.has(id)) continue;
    reordered.push(row);
    seen.add(id);
  }

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    reordered.push(row);
  }

  return reordered;
};

export const useRowDrafts = <
  TDraft extends WithId,
  TCommitted extends WithId,
  TField extends keyof TDraft & string,
>(
  config: UseRowDraftsConfig<TDraft, TCommitted, TField>
): UseRowDraftsResult<TDraft, TField> => {
  const configRef = React.useRef(config);
  React.useLayoutEffect(() => {
    configRef.current = config;
  }, [config]);

  // Sidst-redigerede (rowId, field) før commit. onFieldChange kaldes altid umiddelbart
  // før onRowBlur/commitRow, så dette identificerer hvilken celle der udløste commit'et.
  // Bruges til at bygge fieldPath = `rowId:colIndex` til undo-origin.
  const lastEditedRef = React.useRef<{ rowId: RowId; field: TField } | null>(null);

  const resolveCommitOrigin = React.useCallback((rowId: RowId): RowCommitOrigin | undefined => {
    const cfg = configRef.current;
    const last = lastEditedRef.current;
    const map = cfg.fieldColIndex;
    if (!map || !last || last.rowId !== rowId) return undefined;
    const colIndex = map[last.field];
    if (colIndex === undefined) return undefined;
    return { fieldPath: `${rowId}:${colIndex}` };
  }, []);

  const [draftRows, setDraftRows] = React.useState<TDraft[]>(() => {
    const committed0 = getEnsuredCommitted(config.getCommitted(), config);
    return config.toDraft(committed0);
  });

  const draftRowsRef = React.useRef<TDraft[]>(draftRows);
  React.useEffect(() => {
    draftRowsRef.current = draftRows;
  }, [draftRows]);

  const resetDraftFromCommitted = React.useCallback(() => {
    const cfg = configRef.current;
    const ensured = getEnsuredCommitted(cfg.getCommitted(), cfg);
    const nextDrafts = cfg.toDraft(ensured);
    draftRowsRef.current = nextDrafts;
    setDraftRows(nextDrafts);
  }, []);

  const [internalResyncToken, bumpInternalResyncToken] = React.useReducer((v: number) => v + 1, 0);

  React.useLayoutEffect(() => {
    if (internalResyncToken === 0) return;
    resetDraftFromCommitted();
  }, [resetDraftFromCommitted, internalResyncToken]);

  React.useEffect(() => {
    resetDraftFromCommitted();
  }, [resetDraftFromCommitted, config.resyncToken]);

  const onFieldChange = React.useCallback(
    (rowId: RowId, field: TField) => (value: string) => {
      lastEditedRef.current = { rowId, field };
      const current = draftRowsRef.current;
      const next = current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
      draftRowsRef.current = next;
      setDraftRows(next);
    },
    []
  );

  const computeNextCommittedForRow = React.useCallback(
    (prevRows: TCommitted[] | undefined, draft: TDraft): TCommitted[] => {
      const cfg = configRef.current;
      const base = getEnsuredCommitted(prevRows, cfg);
      const prevCommittedRow = base.find((row) => row.id === draft.id);
      const nextRow = cfg.toCommittedRow(draft, prevCommittedRow);

      const exists = base.some((row) => row.id === draft.id);
      const replaced = exists ? base.map((row) => (row.id === draft.id ? nextRow : row)) : [...base, nextRow];
      return cfg.ensureRows(replaced);
    },
    []
  );

  const commitRow = React.useCallback(
    (rowId: RowId): boolean => {
      const draft = draftRowsRef.current.find((row) => row.id === rowId);
      if (!draft) return false;

      let didChange = false;
      configRef.current.setCommitted((prevRows) => {
        const cfg = configRef.current;
        const base = getEnsuredCommitted(prevRows, cfg);
        const next = computeNextCommittedForRow(prevRows, draft);
        // Markøren afspejler en ren, deterministisk sammenligning for samme prevRows.
        // Selve updateren udfører ingen eksterne side effects og bruger altid nyeste
        // committed snapshot fra caller i stedet for hookets potentielt stale values-closure.
        didChange = !committedRowsEqual(base, next);
        return didChange ? next : prevRows;
      }, resolveCommitOrigin(rowId));
      if (!didChange) return false;

      bumpInternalResyncToken();
      return true;
    },
    [computeNextCommittedForRow, resolveCommitOrigin]
  );

  const commitAll = React.useCallback((): boolean => {
    const drafts = draftRowsRef.current;
    let didChange = false;
    configRef.current.setCommitted((prevRows) => {
      const cfg = configRef.current;
      const base = getEnsuredCommitted(prevRows, cfg);
      const byId = new Map<RowId, TCommitted>(base.map((row) => [row.id, row]));
      const committed = drafts.map((draft) => cfg.toCommittedRow(draft, byId.get(draft.id)));
      const next = cfg.ensureRows(committed);
      didChange = !committedRowsEqual(base, next);
      return didChange ? next : prevRows;
    });
    if (!didChange) return false;

    bumpInternalResyncToken();
    return true;
  }, []);

  const onRowBlur = React.useCallback(
    (rowId: RowId) => {
      commitRow(rowId);
    },
    [commitRow]
  );

  const addRow = React.useCallback(() => {
    configRef.current.setCommitted((prevRows) => {
      const cfg = configRef.current;
      const base = getEnsuredCommitted(prevRows, cfg);
      const id = cfg.createId();
      const newRow = cfg.createEmptyCommittedRow(id);

      const last = base[base.length - 1];
      const inserted = last && cfg.isRowEmpty(last) ? [...base.slice(0, -1), newRow, last] : [...base, newRow];
      return cfg.ensureRows(inserted);
    });
    bumpInternalResyncToken();
  }, []);

  const removeRow = React.useCallback(
    (rowId: RowId) => {
      configRef.current.setCommitted((prevRows) => {
        const cfg = configRef.current;
        const base = getEnsuredCommitted(prevRows, cfg);
        const next = base.filter((row) => row.id !== rowId);
        return cfg.ensureRows(next);
      });
      bumpInternalResyncToken();
    },
    []
  );

  const reorderRows = React.useCallback((orderedIds: readonly RowId[]) => {
    configRef.current.setCommitted((prevRows) => {
      const cfg = configRef.current;
      const base = getEnsuredCommitted(prevRows, cfg);
      return cfg.ensureRows(reorderRowsByIds(base, orderedIds));
    });
    bumpInternalResyncToken();
  }, []);

  return {
    draftRows,
    onFieldChange,
    onRowBlur,
    commitRow,
    commitAll,
    addRow,
    removeRow,
    reorderRows,
    resetDraftFromCommitted,
  };
};

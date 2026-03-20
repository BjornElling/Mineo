import * as React from 'react';
import type { RowId, RowErrors, WithId } from './types';

export type UseRowDraftsConfig<
  TDraft extends WithId,
  TCommitted extends WithId,
  TField extends keyof TDraft & string,
> = {
  // 1) Access to committed state
  getCommitted: () => TCommitted[] | undefined;
  setCommitted: (updater: (prevRows: TCommitted[] | undefined) => TCommitted[] | undefined) => void;

  // 2) Mapping between committed and draft
  toDraft: (rows: TCommitted[]) => TDraft[];
  toCommittedRow: (draft: TDraft, prevCommittedRow?: TCommitted) => TCommitted;

  // 3) Row-policy
  isRowEmpty: (row: TCommitted) => boolean;
  ensureRows: (rows: TCommitted[] | undefined) => TCommitted[];

  // 4) ID generation (used for addRow / empty init helpers)
  createId: () => RowId;
  createEmptyCommittedRow: (id: RowId) => TCommitted;

  // 5) Optional draft init when committed is empty/undefined
  initFromCommitted?: (rows: TCommitted[] | undefined) => TCommitted[];

  // 6) Optional per-row validation on draft
  validateDraftRow?: (draft: TDraft) => Partial<Record<TField, string>>;

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
  setDraftRows: React.Dispatch<React.SetStateAction<TDraft[]>>;

  onFieldChange: (rowId: RowId, field: TField) => (value: string) => void;
  onFieldBlur: (rowId: RowId, field?: TField) => void;

  commitRow: (rowId: RowId) => void;
  commitAll: () => void;

  addRow: () => void;
  removeRow: (rowId: RowId) => void;
  resetDraftFromCommitted: () => void;

  rowErrors: RowErrors<RowId, TField>;
};

const getEnsuredCommitted = <TCommitted extends WithId>(
  rows: TCommitted[] | undefined,
  config: Pick<UseRowDraftsConfig<WithId, TCommitted, never>, 'ensureRows' | 'initFromCommitted'>
): TCommitted[] => {
  return config.initFromCommitted?.(rows) ?? config.ensureRows(rows);
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

  const rowErrors = React.useMemo<RowErrors<RowId, TField>>(() => {
    const next: RowErrors<RowId, TField> = {};
    if (!config.validateDraftRow) return next;
    for (const row of draftRows) {
      next[row.id] = config.validateDraftRow(row);
    }
    return next;
  }, [draftRows, config]);

  const onFieldChange = React.useCallback(
    (rowId: RowId, field: TField) => (value: string) => {
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
    (rowId: RowId) => {
      const draft = draftRowsRef.current.find((row) => row.id === rowId);
      if (!draft) return;

      configRef.current.setCommitted((prevRows) => computeNextCommittedForRow(prevRows, draft));
      bumpInternalResyncToken();
    },
    [computeNextCommittedForRow]
  );

  const commitAll = React.useCallback(() => {
    const drafts = draftRowsRef.current;
    configRef.current.setCommitted((prevRows) => {
      const cfg = configRef.current;
      const base = getEnsuredCommitted(prevRows, cfg);
      const byId = new Map<RowId, TCommitted>(base.map((row) => [row.id, row]));
      const committed = drafts.map((draft) => cfg.toCommittedRow(draft, byId.get(draft.id)));
      return cfg.ensureRows(committed);
    });
    bumpInternalResyncToken();
  }, []);

  const onFieldBlur = React.useCallback(
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

  return {
    draftRows,
    setDraftRows,
    onFieldChange,
    onFieldBlur,
    commitRow,
    commitAll,
    addRow,
    removeRow,
    resetDraftFromCommitted,
    rowErrors,
  };
};

import type { RowId } from '../../rowDrafts/types';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import { createRowId } from '../../utils/rowId';
import { commitIsoDateFromDraftString } from '../dates/dateCommit';
import { ensureRowsWithTrailingEmpty } from '../../utils/tableRows';
import { isFerieRowEmpty } from './rowEmpty';
import type { FerieDraftRow } from './tableDraftRows';

export const createTafFerieRowId = (): RowId => createRowId('taf_ferie_row');

export const createFravaerRowId = (): RowId => createRowId('fravaer_row');

export const createEmptyFerieCommittedRow = (id: RowId): FerieperiodeRow => ({
  id,
  fra: undefined,
  til: undefined,
});

const ensureFerieRowsWithIdFactory = (
  rows: FerieperiodeRow[] | undefined,
  createId: () => RowId
): FerieperiodeRow[] => {
  const normalized: FerieperiodeRow[] =
    Array.isArray(rows) && rows.length > 0
      ? rows.map((row) => ({
          id: row.id || createId(),
          fra: row.fra,
          til: row.til,
        }))
      : [createEmptyFerieCommittedRow(createId())];

  return ensureRowsWithTrailingEmpty(normalized, isFerieRowEmpty, () => createEmptyFerieCommittedRow(createId()));
};

export const ensureTafFerieRows = (rows: FerieperiodeRow[] | undefined): FerieperiodeRow[] => {
  return ensureFerieRowsWithIdFactory(rows, createTafFerieRowId);
};

export const ensureFravaerRows = (rows: FerieperiodeRow[] | undefined): FerieperiodeRow[] => {
  return ensureFerieRowsWithIdFactory(rows, createFravaerRowId);
};

export const committedToFerieDraftRows = (rows: FerieperiodeRow[]): FerieDraftRow[] => {
  return rows.map((row) => ({
    id: row.id,
    fra: row.fra ?? '',
    til: row.til ?? '',
  }));
};

export const ferieDraftToCommittedRow = (draft: FerieDraftRow): FerieperiodeRow => {
  return {
    id: draft.id,
    fra: commitIsoDateFromDraftString(draft.fra),
    til: commitIsoDateFromDraftString(draft.til),
  };
};

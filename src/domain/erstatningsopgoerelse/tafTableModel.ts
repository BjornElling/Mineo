import type { RowId } from '../../rowDrafts/types';
import type { TafPeriodeRow } from '../../schemas/formSchemas';
import { createRowId } from '../rowId';
import { commitIsoDateFromDraftString } from '../dates/dateCommit';
import { ensureRowsWithTrailingEmpty } from '../tableRowManagement';
import { isTafRowEmpty } from './rowEmpty';
import type { TafDraftRow } from './tableDraftRows';

export const createTafRowId = (): RowId => createRowId('taf_row');

export const createEmptyTafCommittedRow = (id: RowId): TafPeriodeRow => ({
  id,
  fra: undefined,
  til: undefined,
  loseFeriedage: undefined,
});

export const ensureTafRows = (rows: TafPeriodeRow[] | undefined): TafPeriodeRow[] => {
  const normalized: TafPeriodeRow[] =
    Array.isArray(rows) && rows.length > 0
      ? rows.map((row) => ({
          id: row.id || createTafRowId(),
          fra: row.fra,
          til: row.til,
          loseFeriedage: row.loseFeriedage,
        }))
      : [createEmptyTafCommittedRow(createTafRowId())];

  return ensureRowsWithTrailingEmpty(normalized, isTafRowEmpty, () => createEmptyTafCommittedRow(createTafRowId()));
};

export const committedToTafDraftRows = (rows: TafPeriodeRow[]): TafDraftRow[] => {
  return rows.map((row) => ({
    id: row.id,
    fra: row.fra ?? '',
    til: row.til ?? '',
    loseFeriedage: typeof row.loseFeriedage === 'number' ? String(row.loseFeriedage) : '',
  }));
};

export const parseOptionalIntegerFromString = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const tafDraftToCommittedRow = (draft: TafDraftRow): TafPeriodeRow => {
  return {
    id: draft.id,
    fra: commitIsoDateFromDraftString(draft.fra),
    til: commitIsoDateFromDraftString(draft.til),
    loseFeriedage: parseOptionalIntegerFromString(draft.loseFeriedage),
  };
};

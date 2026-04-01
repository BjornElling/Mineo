import type { RowId } from '../../../rowDrafts/types';
import type { SvieSmertePeriodeRow } from '../../../schemas/formSchemas';
import { tilstandEnum } from '../../../schemas/formSchemas';
import { ensureRowsWithTrailingEmpty } from '../../../utils/tableRows';
import { createRowId } from '../../../utils/rowId';
import { commitIsoDateFromDraftString } from '../../dates/dateCommit';
import { isSvieSmerteRowEmpty } from '../helpers/rowEmpty';
import type { SvieSmerteDraftRow } from './tableDraftRows';

export type SvieSmerteDerived = Readonly<{
  hasRangeError: boolean;
  antalDage: number | null;
}>;

export const createSvieRowId = (): RowId => createRowId('svie_row');

export const createEmptySvieCommittedRow = (id: RowId): SvieSmertePeriodeRow => ({
  id,
  fra: undefined,
  til: undefined,
  tilstand: undefined,
});

export const ensureSvieRows = (rows: SvieSmertePeriodeRow[] | undefined): SvieSmertePeriodeRow[] => {
  const normalized: SvieSmertePeriodeRow[] =
    Array.isArray(rows) && rows.length > 0
      ? rows.map((row) => ({
          id: row.id || createSvieRowId(),
          fra: row.fra,
          til: row.til,
          tilstand: row.tilstand,
        }))
      : [createEmptySvieCommittedRow(createSvieRowId())];

  return ensureRowsWithTrailingEmpty(normalized, isSvieSmerteRowEmpty, () => createEmptySvieCommittedRow(createSvieRowId()));
};

export const committedToSvieDraftRows = (rows: SvieSmertePeriodeRow[]): SvieSmerteDraftRow[] => {
  return rows.map((row) => ({
    id: row.id,
    fra: row.fra ?? '',
    til: row.til ?? '',
    tilstand: row.tilstand ?? '',
  }));
};

export const svieDraftToCommittedRow = (draft: SvieSmerteDraftRow): SvieSmertePeriodeRow => {
  const parsedTilstand = tilstandEnum.safeParse(draft.tilstand.trim());
  return {
    id: draft.id,
    fra: commitIsoDateFromDraftString(draft.fra),
    til: commitIsoDateFromDraftString(draft.til),
    tilstand: parsedTilstand.success ? parsedTilstand.data : undefined,
  };
};

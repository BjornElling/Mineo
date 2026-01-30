import type { RowId } from '../../rowDrafts/types';
import type { RentekravRow } from '../../schemas/formSchemas';
import { tillaegstidEnhedEnum } from '../../schemas/formSchemas';
import { commitIsoDateFromDraftString } from '../dates/dateCommit';
import { createRowId } from '../rowId';
import { ensureRowsWithTrailingEmpty } from '../tableRowManagement';
import { isRentekravRowEmpty } from './rowEmpty';
import type { RentekravDraftRow } from './tableDraftRows';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToDraftString, parseAmountInput } from '../../utils/expressionAmount';
import { roundHalfAwayFromZero } from '../../utils/formatUtils';

export const createRentekravRowId = (): RowId => createRowId('rentekrav_row');

export const createEmptyRentekravCommittedRow = (id: RowId): RentekravRow => ({
  id,
  belob: undefined,
  renterFra: undefined,
  tillaegstid: undefined,
  enhed: 'dage',
});

export const ensureRentekravRows = (rows: RentekravRow[] | undefined): RentekravRow[] => {
  const normalized: RentekravRow[] =
    Array.isArray(rows) && rows.length > 0
      ? rows.map((row) => ({
          id: row.id || createRentekravRowId(),
          belob: row.belob,
          renterFra: row.renterFra,
          tillaegstid: row.tillaegstid,
          enhed: row.enhed ?? 'dage',
        }))
      : [createEmptyRentekravCommittedRow(createRentekravRowId())];

  return ensureRowsWithTrailingEmpty(normalized, isRentekravRowEmpty, () => createEmptyRentekravCommittedRow(createRentekravRowId()));
};

export const committedToRentekravDraftRows = (rows: RentekravRow[]): RentekravDraftRow[] => {
  return rows.map((row) => ({
    id: row.id,
    belob: amountValueToDraftString(row.belob, 2),
    renterFra: row.renterFra ?? '',
    tillaegstid: typeof row.tillaegstid === 'number' ? String(row.tillaegstid) : '',
    enhed: row.enhed ?? 'dage',
  }));
};

const parseOptionalAmountFromString = (value: string, prev?: AmountValue): AmountValue | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = parseAmountInput(trimmed, {
    precision: 2,
    allowNegative: false,
    round: (v) => roundHalfAwayFromZero(v, 2),
  });
  if (!parsed.ok) return prev;
  return parsed.value;
};

export const parseOptionalIntegerFromString = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const rentekravDraftToCommittedRow = (draft: RentekravDraftRow, prev?: RentekravRow): RentekravRow => {
  const parsedEnhed = tillaegstidEnhedEnum.safeParse(draft.enhed.trim());
  return {
    id: draft.id,
    belob: parseOptionalAmountFromString(draft.belob, prev?.belob),
    renterFra: commitIsoDateFromDraftString(draft.renterFra),
    tillaegstid: parseOptionalIntegerFromString(draft.tillaegstid),
    enhed: parsedEnhed.success ? parsedEnhed.data : 'dage',
  };
};

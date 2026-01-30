import type { RowId } from '../../rowDrafts/types';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import { createRowId } from '../rowId';
import { commitIsoDateFromDraftString } from '../dates/dateCommit';
import { ensureRowsWithTrailingEmpty } from '../tableRowManagement';
import { isOevrigeKravRowEmpty } from './rowEmpty';
import type { OevrigeKravDraftRow } from './tableDraftRows';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToDraftString, parseAmountInput } from '../../utils/expressionAmount';
import { roundHalfAwayFromZero } from '../../utils/formatUtils';

export const createOevrigeKravRowId = (): RowId => createRowId('oevrige_krav_row');

export const createEmptyOevrigeKravCommittedRow = (id: RowId): OevrigeKravRow => ({
  id,
  dato: undefined,
  udgiftTil: undefined,
  beloeb: undefined,
});

export const ensureOevrigeKravRows = (rows: OevrigeKravRow[] | undefined): OevrigeKravRow[] => {
  const normalized: OevrigeKravRow[] =
    Array.isArray(rows) && rows.length > 0
      ? rows.map((row) => ({
          id: row.id || createOevrigeKravRowId(),
          dato: row.dato,
          udgiftTil: row.udgiftTil,
          beloeb: row.beloeb,
        }))
      : [createEmptyOevrigeKravCommittedRow(createOevrigeKravRowId())];

  return ensureRowsWithTrailingEmpty(
    normalized,
    isOevrigeKravRowEmpty,
    () => createEmptyOevrigeKravCommittedRow(createOevrigeKravRowId())
  );
};

export const committedToOevrigeKravDraftRows = (rows: OevrigeKravRow[]): OevrigeKravDraftRow[] => {
  return rows.map((row) => ({
    id: row.id,
    dato: row.dato ?? '',
    udgiftTil: row.udgiftTil ?? '',
    beloeb: amountValueToDraftString(row.beloeb, 2),
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

export const oevrigeKravDraftToCommittedRow = (draft: OevrigeKravDraftRow, prev?: OevrigeKravRow): OevrigeKravRow => {
  return {
    id: draft.id,
    dato: commitIsoDateFromDraftString(draft.dato),
    udgiftTil: draft.udgiftTil.trim() || undefined,
    beloeb: parseOptionalAmountFromString(draft.beloeb, prev?.beloeb),
  };
};

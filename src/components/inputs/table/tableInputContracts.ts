import { prefixZeroBeforeLeadingComma, trimToAlphanumericEdges, trimToNumericEdgesPreserveLeadingMinus } from '../../../utils/draftNormalization';

export type TableInputErrorKind = 'none' | 'input' | 'config';

export type TableInputErrorInfo = Readonly<{
  hasError: boolean;
  kind: TableInputErrorKind;
}>;

/**
 * Canonical commit-time normalization for table input drafts.
 *
 * Contract:
 * - Applied ONLY on blur/commit (never while typing).
 * - Trims everything before the first letter/digit and after the last letter/digit.
 */
export const normalizeTableDraftOnCommit = (draft: string): string => {
  // Tables consist of numeric/date-like inputs; normalize aggressively at commit.
  // This must happen BEFORE commit parsing so a trimmed value can be accepted without showing an error.
  return trimToAlphanumericEdges(draft);
};

/**
 * Commit-time normalization for amount-table cells.
 *
 * Same as `normalizeTableDraftOnCommit`, except it preserves a leading '-' for negative values.
 */
export const normalizeTableAmountDraftOnCommit = (draft: string): string => {
  return prefixZeroBeforeLeadingComma(trimToNumericEdgesPreserveLeadingMinus(draft));
};

/**
 * Canonical committed table value.
 *
 * Invariant:
 * - Only use this type for values that are fully normalized/validated by the input’s commit logic.
 * - Never brand raw user drafts as committed values.
 */
export type TableCommittedString = string & { readonly __brand: 'TableCommittedString' };

export const asTableCommittedString = (value: string): TableCommittedString => {
  return value as TableCommittedString;
};

export type TableCommitResult =
  | { kind: 'ok'; committed: TableCommittedString }
  | { kind: 'input-error'; committed: string; errorMessage: string }
  | { kind: 'config-error'; committed: string };

/**
 * Convert a commit result to the exact string that should be persisted in the table model.
 *
 * Contract:
 * - This MUST match what the corresponding input would emit on blur for the same raw draft.
 * - `ok` returns the canonical committed value.
 * - `input-error` and `config-error` return the raw draft as-is (no hidden normalization).
 */
export const committedToString = (result: TableCommitResult): string => {
  return result.committed;
};

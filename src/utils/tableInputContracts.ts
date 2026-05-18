import { prefixZeroBeforeLeadingComma, trimToAlphanumericEdges, trimToNumericEdgesPreserveLeadingMinus } from './draftNormalization';

export type TableInputErrorKind = 'none' | 'input' | 'visual' | 'config';

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
export const normalizeTableNumericDraftOnCommit = (draft: string): string => {
  return prefixZeroBeforeLeadingComma(trimToNumericEdgesPreserveLeadingMinus(draft));
};

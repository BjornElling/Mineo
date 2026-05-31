import { prefixZeroBeforeLeadingComma, trimToAlphanumericEdges, trimToNumericEdgesPreserveLeadingMinus } from './draftNormalization';

export type TableInputErrorKind = 'none' | 'input' | 'visual' | 'config';

export type TableInputErrorInfo = Readonly<{
  hasError: boolean;
  kind: TableInputErrorKind;
}>;

/**
 * Kanonisk commit-tids-normalisering for tabel-input-drafts.
 *
 * Kontrakt:
 * - Anvendes KUN ved blur/commit (aldrig mens der tastes).
 * - Trimmer alt før det første bogstav/ciffer og efter det sidste bogstav/ciffer.
 */
export const normalizeTableDraftOnCommit = (draft: string): string => {
  // Tabeller består af numeriske/dato-lignende inputs; normalisér aggressivt ved commit.
  // Dette skal ske FØR commit-parsing, så en trimmet værdi kan accepteres uden at vise en fejl.
  return trimToAlphanumericEdges(draft);
};

/**
 * Commit-tids-normalisering for beløbs-tabelceller.
 *
 * Samme som `normalizeTableDraftOnCommit`, bortset fra at den bevarer et foranstillet '-' for negative værdier.
 */
export const normalizeTableNumericDraftOnCommit = (draft: string): string => {
  return prefixZeroBeforeLeadingComma(trimToNumericEdgesPreserveLeadingMinus(draft));
};

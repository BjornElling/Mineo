import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';

/**
 * Canonical commit rule for date drafts (Form Contract):
 * - Only called on blur/commit
 * - Empty or invalid input commits to `undefined`
 * - Valid Danish or ISO dates commit to ISO (yyyy-mm-dd)
 */
export const commitIsoDateFromDraftString = (draft: string): ISODateString | undefined => {
  const trimmed = draft.trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};


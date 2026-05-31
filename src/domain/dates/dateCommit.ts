import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';

/**
 * Kanonisk commit-regel for dato-drafts (Form Contract):
 * - Kaldes kun på blur/commit
 * - Tomt eller ugyldigt input committer til `undefined`
 * - Gyldige danske eller ISO-datoer committer til ISO (yyyy-mm-dd)
 */
export const commitIsoDateFromDraftString = (draft: string): ISODateString | undefined => {
  const trimmed = draft.trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};


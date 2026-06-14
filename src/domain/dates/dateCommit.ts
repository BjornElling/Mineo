import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';

/**
 * Kanonisk commit-regel for dato-drafts (Form Contract):
 * - Kaldes kun på blur/commit
 * - Tomt eller ugyldigt input committer til `undefined`
 * - Gyldige danske eller ISO-datoer committer til ISO (yyyy-mm-dd)
 *
 * Bevidst forskel fra `parseDateDraftForCommit` (dateDraftCommit.ts): denne tager KUN
 * allerede-normaliserede strenge (tom, dansk dd-mm-åååå eller ISO). Den bruges af
 * tabel-modellernes draft→committed-konvertering, hvor rå tastetryk allerede er
 * parset til ISO af grid-adapteren (dateAdapter), så den rige parser (komprimeret
 * input, 2-cifret års-policy mv.) hører hjemme i adapter-laget, ikke her.
 */
export const commitIsoDateFromDraftString = (draft: string): ISODateString | undefined => {
  const trimmed = draft.trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};


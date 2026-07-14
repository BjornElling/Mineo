import { makeYearFingerprintFromCanonical, type CommittedPayload, type YearFingerprint } from '../../../types/parserSpec';
import { shouldClearField } from '../../../utils/inputValidation';
import { filterYearKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeYearPaste } from '../../../utils/inputPasteNormalization';
import { parseYearDraftForCommit, type TwoDigitYearPolicy } from '../../../utils/yearDraftCore';
import { normalizeTableDraftOnCommit } from '../../../utils/tableInputContracts';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

const MAX_YEAR_DRAFT_LENGTH = 6; // 4 cifre + tolerance for whitespace før commit-normalisering.

export type TableYearInputModel = string;
export type TableYearPolicy = TwoDigitYearPolicy;

export type TableYearAdapterConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TableYearPolicy;
}>;

const parseYearOnCommit = (
  draft: string,
  config: TableYearAdapterConfig
): { ok: true; value: string } | { ok: false; errorMessage: string } => {
  const normalized = normalizeTableDraftOnCommit(draft);
  if (normalized.trim() === '' || shouldClearField(normalized)) return { ok: true, value: '' };

  // Fortolkning + interval deles med formularfeltet via den fælles kerne (ensartet ordlyd, A2).
  const result = parseYearDraftForCommit(normalized, config);
  if (!result.ok) return { ok: false, errorMessage: result.errorMessage };
  return { ok: true, value: result.value === undefined ? '' : String(result.value) };
};

export const toCommittedYearPayload = (
  value: TableYearInputModel
): CommittedPayload<TableYearInputModel, string, YearFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: makeYearFingerprintFromCanonical(canonical),
  };
};

export const createYearTableInputAdapter = (
  config: TableYearAdapterConfig
): TableInputAdapter<TableYearInputModel, string, YearFingerprint> => ({
  format: (value) => value,
  parse: (draft) => parseYearOnCommit(draft, config),
  toCommittedPayload: toCommittedYearPayload,
  isValidStartKey: (key) => /^[0-9]$/.test(key),
  applyPaste: (raw, context) => {
    const normalized = normalizeYearPaste(raw, config);
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    return spliceDraftPaste(context, normalized);
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    filterYearKeyDown(e);
    return e.defaultPrevented;
  },
  normalizeDraftChange: (draft) => draft.slice(0, MAX_YEAR_DRAFT_LENGTH),
  preserveInvalidDraft: true,
  useSaveError: true,
});

import { makeWeekFingerprintFromCanonical, type CommittedPayload, type WeekFingerprint } from '../../../types/parserSpec';
import { shouldClearField } from '../../../utils/inputValidation';
import { filterWeekKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeWeekPaste } from '../../../utils/inputPasteNormalization';
import { parseWeekDraftForCommit } from '../../../utils/weekDraftCore';
import type { TwoDigitYearPolicy } from '../../../utils/yearDraftCore';
import { normalizeTableDraftOnCommit } from '../../../utils/tableInputContracts';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

const MAX_WEEK_DRAFT_LENGTH = 8;

export type TableWeekInputModel = string;

export type TableWeekAdapterConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TwoDigitYearPolicy;
}>;

const parseWeekOnCommit = (
  draft: string,
  { minYear, maxYear, twoDigitYearPolicy }: TableWeekAdapterConfig
): { ok: true; value: string } | { ok: false; errorMessage: string } => {
  const normalized = normalizeTableDraftOnCommit(draft);
  if (normalized.trim() === '' || shouldClearField(normalized)) return { ok: true, value: '' };

  // Uge-/år-fortolkning + interval deles med formularfeltet via den fælles kerne (ensartet ordlyd, A2).
  const result = parseWeekDraftForCommit(normalized, {
    minYear,
    maxYear,
    twoDigitYearPolicy,
    maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
  });
  if (!result.ok) return { ok: false, errorMessage: result.errorMessage };
  return { ok: true, value: result.value === undefined ? '' : result.value };
};

export const toCommittedWeekPayload = (
  value: TableWeekInputModel
): CommittedPayload<TableWeekInputModel, string, WeekFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: makeWeekFingerprintFromCanonical(canonical),
  };
};

export const createWeekTableInputAdapter = (
  config: TableWeekAdapterConfig
): TableInputAdapter<TableWeekInputModel, string, WeekFingerprint> => ({
  format: (value) => value,
  parse: (draft) => parseWeekOnCommit(draft, config),
  toCommittedPayload: toCommittedWeekPayload,
  isValidStartKey: (key) => /^[0-9]$/.test(key),
  applyPaste: (raw, context) => {
    const normalized = normalizeWeekPaste(raw, {
      ...config,
      maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
    });
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    return spliceDraftPaste(context, normalized);
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    if (context.hasError) return false;
    filterWeekKeyDown(e);
    return e.defaultPrevented;
  },
  normalizeDraftChange: (draft) => draft.slice(0, MAX_WEEK_DRAFT_LENGTH),
  preserveInvalidDraft: true,
  useSaveError: true,
});

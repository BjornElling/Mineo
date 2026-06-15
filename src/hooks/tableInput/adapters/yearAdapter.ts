import { makeYearFingerprintFromCanonical, type CommittedPayload, type YearFingerprint } from '../../../types/parserSpec';
import { shouldClearField } from '../../../utils/inputValidation';
import { interpretYear } from '../../../utils/dateInputValidation';
import { filterYearKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeYearPaste } from '../../../utils/inputPasteNormalization';
import { normalizeTableDraftOnCommit } from '../../../utils/tableInputContracts';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

const MAX_YEAR_DRAFT_LENGTH = 6; // 4 cifre + tolerance for whitespace før commit-normalisering.

export type TableYearInputModel = string;
export type TableYearPolicy = 'reject' | 'infer' | 'assume20xx';

export type TableYearAdapterConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TableYearPolicy;
}>;

const parseYearOnCommit = (
  draft: string,
  { minYear, maxYear, twoDigitYearPolicy }: TableYearAdapterConfig
): { ok: true; value: string } | { ok: false; errorMessage: string } => {
  const trimmed = normalizeTableDraftOnCommit(draft).trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '' };
  if (/[^0-9]/.test(trimmed)) return { ok: false, errorMessage: 'Ugyldigt format' };
  if (trimmed.length === 3) return { ok: false, errorMessage: 'Ugyldigt årstal' };

  let yearStr: string;
  if (trimmed.length === 1 || trimmed.length === 2) {
    if (twoDigitYearPolicy === 'reject') return { ok: false, errorMessage: 'Ugyldigt årstal' };
    if (twoDigitYearPolicy === 'assume20xx') {
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed)) return { ok: false, errorMessage: 'Ugyldigt årstal' };
      yearStr = String(2000 + parsed);
    } else {
      const interpreted = interpretYear(trimmed);
      if (interpreted === null) return { ok: false, errorMessage: 'Ugyldigt årstal' };
      yearStr = String(interpreted);
    }
  } else if (trimmed.length === 4) {
    yearStr = trimmed;
  } else {
    return { ok: false, errorMessage: 'Ugyldigt årstal' };
  }

  const yearNum = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(yearNum)) return { ok: false, errorMessage: 'Ugyldigt årstal' };

  if (typeof minYear === 'number' && yearNum < minYear) {
    if (typeof maxYear === 'number') return { ok: false, errorMessage: `År skal være mellem ${minYear} og ${maxYear}` };
    return { ok: false, errorMessage: `År skal være ${minYear} eller senere` };
  }
  if (typeof maxYear === 'number' && yearNum > maxYear) {
    if (typeof minYear === 'number') return { ok: false, errorMessage: `År skal være mellem ${minYear} og ${maxYear}` };
    return { ok: false, errorMessage: `År skal være ${maxYear} eller tidligere` };
  }

  return { ok: true, value: yearStr };
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
    const normalized = normalizeYearPaste(raw);
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

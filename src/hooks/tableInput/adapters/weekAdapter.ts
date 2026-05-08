import { makeWeekFingerprintFromCanonical, type CommittedPayload, type WeekFingerprint } from '../../../types/parserSpec';
import { shouldClearField } from '../../../utils/inputValidation';
import { interpretYear } from '../../../utils/dateInputValidation';
import { yearHas53Weeks } from '../../../utils/dateUtils';
import { filterWeekKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeWeekPaste } from '../../../utils/inputPasteNormalization';
import { normalizeTableDraftOnCommit } from '../../../utils/tableInputContracts';
import type { TableInputAdapter } from '../tableInputAdapter';
import type { TableYearPolicy } from './yearAdapter';

const MAX_WEEK_DRAFT_LENGTH = 8;

export type TableWeekInputModel = string;

export type TableWeekAdapterConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TableYearPolicy;
}>;

const parseWeekOnCommit = (
  draft: string,
  { minYear, maxYear, twoDigitYearPolicy }: TableWeekAdapterConfig
): { ok: true; value: string } | { ok: false; errorMessage: string } => {
  const trimmed = normalizeTableDraftOnCommit(draft).trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '' };
  if (trimmed.length > MAX_WEEK_DRAFT_LENGTH) return { ok: false, errorMessage: 'Ugyldigt format' };

  const normalized = trimmed.replace(/[ .:-]/g, '/');
  const parts = normalized.split('/');
  if (parts.length !== 2) return { ok: false, errorMessage: 'Ugyldigt format' };

  const weekStr = parts[0]?.trim() ?? '';
  const yearStrRaw = parts[1]?.trim() ?? '';
  if (weekStr === '' || yearStrRaw === '') return { ok: false, errorMessage: 'Ugyldigt format' };
  if (/[^0-9]/.test(weekStr) || /[^0-9]/.test(yearStrRaw)) return { ok: false, errorMessage: 'Ugyldigt format' };

  const week = Number.parseInt(weekStr, 10);
  if (!Number.isFinite(week) || week < 1 || week > 53) return { ok: false, errorMessage: 'Ugyldig uge' };

  let yearStr: string;
  if (yearStrRaw.length === 1 || yearStrRaw.length === 2) {
    if (twoDigitYearPolicy === 'reject') return { ok: false, errorMessage: 'Ugyldigt årstal' };
    if (twoDigitYearPolicy === 'assume20xx') {
      const parsed = Number.parseInt(yearStrRaw, 10);
      if (!Number.isFinite(parsed)) return { ok: false, errorMessage: 'Ugyldigt årstal' };
      yearStr = String(2000 + parsed);
    } else {
      const interpreted = interpretYear(yearStrRaw);
      if (interpreted === null) return { ok: false, errorMessage: 'Ugyldigt årstal' };
      yearStr = String(interpreted);
    }
  } else if (yearStrRaw.length === 4) {
    yearStr = yearStrRaw;
  } else {
    return { ok: false, errorMessage: 'Ugyldigt årstal' };
  }

  const year = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(year)) return { ok: false, errorMessage: 'Ugyldigt årstal' };

  if (typeof minYear === 'number' && year < minYear) {
    if (typeof maxYear === 'number') return { ok: false, errorMessage: `År skal være mellem ${minYear} og ${maxYear}` };
    return { ok: false, errorMessage: `År skal være ${minYear} eller senere` };
  }
  if (typeof maxYear === 'number' && year > maxYear) {
    if (typeof minYear === 'number') return { ok: false, errorMessage: `År skal være mellem ${minYear} og ${maxYear}` };
    return { ok: false, errorMessage: `År skal være ${maxYear} eller tidligere` };
  }

  const maxWeek = yearHas53Weeks(year) ? 53 : 52;
  if (week > maxWeek) {
    return { ok: false, errorMessage: `Uge skal være mellem 1 og ${maxWeek}` };
  }

  return { ok: true, value: `${String(week).padStart(2, '0')}/${yearStr}` };
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
    const normalized = normalizeWeekPaste(raw);
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    const start = typeof context.selectionStart === 'number' ? context.selectionStart : context.currentDraft.length;
    const end = typeof context.selectionEnd === 'number' ? context.selectionEnd : start;
    const draft = context.currentDraft.slice(0, start) + normalized + context.currentDraft.slice(end);
    return { draft, caretPosition: start + normalized.length };
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    if (context.hasError) return false;
    filterWeekKeyDown(e);
    return e.defaultPrevented;
  },
  normalizeDraftChange: (draft) => draft.slice(0, MAX_WEEK_DRAFT_LENGTH),
  preserveInvalidDraft: true,
  clearErrorOnChange: true,
  useSaveError: true,
});

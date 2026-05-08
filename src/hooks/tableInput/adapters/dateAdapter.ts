import { makeDateFingerprintFromCanonical, type CommittedPayload, type DateFingerprint } from '../../../types/parserSpec';
import { coerceToISODateString, type ISODateString } from '../../../types/branded';
import { shouldClearField } from '../../../utils/inputValidation';
import { interpretYear } from '../../../utils/dateInputValidation';
import { normalizeDateDraftOnCommit, normalizeDateDraftSeparators } from '../../../utils/dateDraftNormalization';
import { normalizeDatePaste } from '../../../utils/inputPasteNormalization';
import { validateISODateRange } from '../../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage, type DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import { filterDateLikeKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { TableInputAdapter } from '../tableInputAdapter';
import type { TableYearPolicy } from './yearAdapter';

export type TableDateInputModel = string;

export type TableDateAdapterConfig = Readonly<{
  minDate?: string;
  maxDate?: string;
  specialRangeErrors?: DateRangeSpecialErrors;
  twoDigitYearPolicy: TableYearPolicy;
}>;

type ParsedDanishDate =
  | Readonly<{ ok: true; value: string; iso?: ISODateString }>
  | Readonly<{ ok: false; errorMessage: string }>;

const parseDanishDateOnCommit = (
  draft: string,
  { twoDigitYearPolicy }: Pick<TableDateAdapterConfig, 'twoDigitYearPolicy'>
): ParsedDanishDate => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '', iso: undefined };
  if (trimmed.length > 64) return { ok: false, errorMessage: 'Ugyldig dato' };

  let dayRaw: string;
  let monthRaw: string;
  let yearRaw: string;

  if (/^\d{6,8}$/.test(trimmed)) {
    dayRaw = trimmed.slice(0, 2);
    monthRaw = trimmed.slice(2, 4);
    yearRaw = trimmed.slice(4);
  } else {
    const normalized = normalizeDateDraftSeparators(trimmed);
    const [dayPart = '', monthPart = '', yearPart = '', ...rest] = normalized.split('-');
    if (rest.length > 0 || dayPart === '' || monthPart === '' || yearPart === '') {
      return { ok: false, errorMessage: 'Ugyldig dato' };
    }

    dayRaw = dayPart;
    monthRaw = monthPart;
    yearRaw = yearPart;
  }

  if (/[^0-9]/.test(dayRaw) || /[^0-9]/.test(monthRaw) || /[^0-9]/.test(yearRaw)) {
    return { ok: false, errorMessage: 'Ugyldig dato' };
  }

  if (dayRaw.length > 2 || monthRaw.length > 2 || yearRaw.length > 4 || yearRaw.length === 3) {
    return { ok: false, errorMessage: 'Ugyldig dato' };
  }

  const day = dayRaw.padStart(2, '0');
  const month = monthRaw.padStart(2, '0');

  let year: string;
  if (yearRaw.length === 1 || yearRaw.length === 2) {
    if (twoDigitYearPolicy === 'reject') return { ok: false, errorMessage: 'Ugyldig dato' };
    if (twoDigitYearPolicy === 'assume20xx') {
      const parsed = Number.parseInt(yearRaw, 10);
      if (!Number.isFinite(parsed)) return { ok: false, errorMessage: 'Ugyldig dato' };
      year = String(2000 + parsed);
    } else {
      const interpreted = interpretYear(yearRaw);
      if (interpreted === null) return { ok: false, errorMessage: 'Ugyldig dato' };
      year = String(interpreted);
    }
  } else if (yearRaw.length === 4) {
    year = yearRaw;
  } else {
    return { ok: false, errorMessage: 'Ugyldig dato' };
  }

  const finalValue = `${day}-${month}-${year}`;
  if (finalValue.length !== 10) return { ok: false, errorMessage: 'Ugyldig dato' };
  const iso = coerceToISODateString(finalValue);
  if (!iso) return { ok: false, errorMessage: 'Ugyldig dato' };

  return { ok: true, value: finalValue, iso };
};

const getRangeErrorMessage = (
  iso: ISODateString,
  { minDate, maxDate, specialRangeErrors }: Pick<TableDateAdapterConfig, 'minDate' | 'maxDate' | 'specialRangeErrors'>
): string | null => {
  const normalizedMin = minDate ? coerceToISODateString(minDate) : undefined;
  const normalizedMax = maxDate ? coerceToISODateString(maxDate) : undefined;
  const rangeResult = validateISODateRange(iso, normalizedMin, normalizedMax);
  if (rangeResult.isValid) return null;
  return resolveDateRangeErrorMessage({ iso, minDate: normalizedMin, maxDate: normalizedMax, special: specialRangeErrors });
};

const dateFingerprintFromCommittedValue = (committedValue: string | undefined): DateFingerprint => {
  const trimmed = (committedValue ?? '').trim();
  if (trimmed === '') return makeDateFingerprintFromCanonical('');
  const iso = coerceToISODateString(trimmed);
  if (!iso) {
    return makeDateFingerprintFromCanonical(trimmed);
  }
  return makeDateFingerprintFromCanonical(iso);
};

export const toCommittedDatePayload = (
  value: TableDateInputModel
): CommittedPayload<TableDateInputModel, string, DateFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: dateFingerprintFromCommittedValue(canonical),
  };
};

export const sanitizeTableDateDraft = (
  rawValue: string,
  config: Pick<TableDateAdapterConfig, 'twoDigitYearPolicy'>
): string => {
  const raw = normalizeDateDraftOnCommit(String(rawValue ?? ''));
  const parsed = parseDanishDateOnCommit(raw, config);
  return parsed.ok ? parsed.value : raw;
};

export const createDateTableInputAdapter = (
  config: TableDateAdapterConfig
): TableInputAdapter<TableDateInputModel, string, DateFingerprint> => ({
  format: (value) => value,
  getCommittedVisualError: (value) => {
    const iso = coerceToISODateString(value);
    if (!iso) return '';
    return getRangeErrorMessage(iso, config) ?? '';
  },
  parse: (draft) => {
    const normalized = normalizeDateDraftOnCommit(draft);
    const parsed = parseDanishDateOnCommit(normalized, config);
    if (!parsed.ok) return { ok: false, errorMessage: parsed.errorMessage };
    const rangeErrorMessage = parsed.iso
      ? getRangeErrorMessage(parsed.iso, {
          minDate: config.minDate,
          maxDate: config.maxDate,
          specialRangeErrors: config.specialRangeErrors,
        })
      : null;
    return rangeErrorMessage ? { ok: true, value: parsed.value, visualErrorMessage: rangeErrorMessage } : { ok: true, value: parsed.value };
  },
  toCommittedPayload: toCommittedDatePayload,
  isValidStartKey: (key) => /^[0-9]$/.test(key),
  applyPaste: (raw, context) => {
    const normalized = normalizeDatePaste(raw);
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
    filterDateLikeKeyDown(e);
    return e.defaultPrevented;
  },
  preserveInvalidDraft: true,
  preserveVisualErrorDraft: false,
  clearErrorOnChange: true,
  useSaveError: true,
});

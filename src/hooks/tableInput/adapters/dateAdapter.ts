import { makeDateFingerprintFromCanonical, type CommittedPayload, type DateFingerprint } from '../../../types/parserSpec';
import { coerceToDanishDateString, coerceToISODateString, type ISODateString } from '../../../types/branded';
import { normalizeDateDraftOnCommit } from '../../../utils/dateDraftNormalization';
import { normalizeDatePaste } from '../../../utils/inputPasteNormalization';
import { validateISODateRange } from '../../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage, type DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import { filterDateLikeKeyDown } from '../../../components/inputs/inputKeyFilters';
import { parseDateDraftForCommit } from '../../../utils/dateDraftCommit';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';
import type { TableYearPolicy } from './yearAdapter';

export type TableDateInputModel = ISODateString | undefined;

export type TableDateAdapterConfig = Readonly<{
  minDate?: string;
  maxDate?: string;
  specialRangeErrors?: DateRangeSpecialErrors;
  twoDigitYearPolicy: TableYearPolicy;
}>;

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

export const toCommittedDatePayload = (
  value: TableDateInputModel
): CommittedPayload<TableDateInputModel, string, DateFingerprint> => {
  const canonical = value ?? '';
  return {
    model: value,
    canonical,
    fingerprint: makeDateFingerprintFromCanonical(canonical),
  };
};

export const sanitizeTableDateDraft = (
  rawValue: string,
  config: Pick<TableDateAdapterConfig, 'twoDigitYearPolicy'>
): ISODateString | undefined => {
  const raw = normalizeDateDraftOnCommit(rawValue);
  const parsed = parseDateDraftForCommit(raw, { mode: 'commit', twoDigitYearPolicy: config.twoDigitYearPolicy });
  return parsed.ok ? parsed.iso : undefined;
};

export const createDateTableInputAdapter = (
  config: TableDateAdapterConfig
): TableInputAdapter<TableDateInputModel, string, DateFingerprint> => ({
  format: (value) => (value ? coerceToDanishDateString(value) ?? '' : ''),
  getCommittedVisualError: (value) => {
    if (!value) return '';
    return getRangeErrorMessage(value, config) ?? '';
  },
  parse: (draft) => {
    const normalized = normalizeDateDraftOnCommit(draft);
    const parsed = parseDateDraftForCommit(normalized, { mode: 'commit', twoDigitYearPolicy: config.twoDigitYearPolicy });
    if (!parsed.ok) return { ok: false, errorMessage: parsed.message };
    const rangeErrorMessage = parsed.iso
      ? getRangeErrorMessage(parsed.iso, {
          minDate: config.minDate,
          maxDate: config.maxDate,
          specialRangeErrors: config.specialRangeErrors,
        })
      : null;
    return rangeErrorMessage ? { ok: true, value: parsed.iso, visualErrorMessage: rangeErrorMessage } : { ok: true, value: parsed.iso };
  },
  toCommittedPayload: toCommittedDatePayload,
  isValidStartKey: (key) => /^[0-9]$/.test(key),
  applyPaste: (raw, context) => {
    const normalized = normalizeDatePaste(raw);
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    return spliceDraftPaste(context, normalized);
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    if (context.hasError) return false;
    filterDateLikeKeyDown(e);
    return e.defaultPrevented;
  },
  preserveInvalidDraft: true,
  useSaveError: true,
});

import type { ISODateString } from '../types/branded';
import { coerceToISODateString } from '../types/branded';
import { interpretYear, isValidDate } from './dateInputValidation';
import { normalizeDateDraftSeparators } from './dateDraftNormalization';
import { shouldClearField } from './inputValidation';

export type DateYearPolicy = 'reject' | 'infer' | 'assume20xx';

export type ParsedDateDraft =
  | Readonly<{ ok: true; danish: string; iso: ISODateString | undefined }>
  | Readonly<{ ok: false; kind: 'invalid'; message: string }>;

const INVALID_DATE_MESSAGE = 'Ugyldig dato';
const MAX_DRAFT_LENGTH = 16;

// Parse afledes altid på commit (form-kernereglen forbyder typing-feedback), så et ufuldstændigt
// input er en egentlig fejl — ikke en "endnu ikke færdig"-tilstand.
const INVALID_DATE: ParsedDateDraft = { ok: false, kind: 'invalid', message: INVALID_DATE_MESSAGE };

const resolveYear = (yearRaw: string, policy: DateYearPolicy): number | null => {
  if (yearRaw.length === 1 || yearRaw.length === 2) {
    if (policy === 'reject') return null;
    if (policy === 'assume20xx') {
      const parsed = Number.parseInt(yearRaw, 10);
      return Number.isFinite(parsed) ? 2000 + parsed : null;
    }
    return interpretYear(yearRaw);
  }

  if (yearRaw.length === 4) {
    const parsed = Number.parseInt(yearRaw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const parseDateDraftForCommit = (
  draft: string,
  options: Readonly<{ twoDigitYearPolicy: DateYearPolicy }>
): ParsedDateDraft => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, danish: '', iso: undefined };
  if (trimmed.length > MAX_DRAFT_LENGTH) return INVALID_DATE;

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
    if (rest.length > 0 || dayPart === '' || monthPart === '' || yearPart === '') return INVALID_DATE;
    dayRaw = dayPart;
    monthRaw = monthPart;
    yearRaw = yearPart;
  }

  if (/[^0-9]/.test(dayRaw) || /[^0-9]/.test(monthRaw) || /[^0-9]/.test(yearRaw)) {
    return INVALID_DATE;
  }
  if (dayRaw.length > 2 || monthRaw.length > 2 || yearRaw.length > 4 || yearRaw.length === 3) {
    return INVALID_DATE;
  }

  const dayNum = Number.parseInt(dayRaw, 10);
  const monthNum = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum)) return INVALID_DATE;
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return INVALID_DATE;

  const resolvedYear = resolveYear(yearRaw, options.twoDigitYearPolicy);
  if (resolvedYear === null) return INVALID_DATE;

  // Kanonisk dag-i-måned-validering (skudår mv.) — én sand kilde i isValidDate,
  // frem for ad hoc Date.UTC(...,0)-konstruktion her.
  if (!isValidDate(dayNum, monthNum, resolvedYear)) return INVALID_DATE;

  const danish = `${String(dayNum).padStart(2, '0')}-${String(monthNum).padStart(2, '0')}-${String(resolvedYear)}`;
  const iso = coerceToISODateString(danish);
  if (!iso) return INVALID_DATE;

  return { ok: true, danish, iso };
};

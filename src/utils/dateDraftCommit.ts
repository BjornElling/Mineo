import type { ISODateString } from '../types/branded';
import { coerceToISODateString } from '../types/branded';
import { interpretYear } from './dateInputValidation';
import { normalizeDateDraftSeparators } from './dateDraftNormalization';
import { shouldClearField } from './inputValidation';

export type DateYearPolicy = 'reject' | 'infer' | 'assume20xx';

export type DateDraftParseMode = 'typing' | 'commit';

export type ParsedDateDraft =
  | Readonly<{ ok: true; danish: string; iso: ISODateString | undefined }>
  | Readonly<{ ok: false; kind: 'partial' | 'invalid'; message: string }>;

const INVALID_DATE_MESSAGE = 'Ugyldig dato';
const MAX_DRAFT_LENGTH = 16;

const invalidDate = (mode: DateDraftParseMode): ParsedDateDraft =>
  mode === 'typing'
    ? { ok: false, kind: 'partial', message: INVALID_DATE_MESSAGE }
    : { ok: false, kind: 'invalid', message: INVALID_DATE_MESSAGE };

const resolveYear = (
  yearRaw: string,
  policy: DateYearPolicy,
  mode: DateDraftParseMode
): number | null | 'partial' => {
  if (yearRaw.length === 1 || yearRaw.length === 2) {
    if (mode === 'typing') return 'partial';
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
  options: Readonly<{ mode: DateDraftParseMode; twoDigitYearPolicy: DateYearPolicy }>
): ParsedDateDraft => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, danish: '', iso: undefined };
  if (trimmed.length > MAX_DRAFT_LENGTH) return invalidDate(options.mode);

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
    if (rest.length > 0 || dayPart === '' || monthPart === '' || yearPart === '') return invalidDate(options.mode);
    dayRaw = dayPart;
    monthRaw = monthPart;
    yearRaw = yearPart;
  }

  if (/[^0-9]/.test(dayRaw) || /[^0-9]/.test(monthRaw) || /[^0-9]/.test(yearRaw)) {
    return invalidDate(options.mode);
  }
  if (dayRaw.length > 2 || monthRaw.length > 2 || yearRaw.length > 4 || yearRaw.length === 3) {
    return invalidDate(options.mode);
  }

  const dayNum = Number.parseInt(dayRaw, 10);
  const monthNum = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum)) return invalidDate(options.mode);
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return invalidDate(options.mode);

  const resolvedYear = resolveYear(yearRaw, options.twoDigitYearPolicy, options.mode);
  if (resolvedYear === 'partial') return { ok: false, kind: 'partial', message: INVALID_DATE_MESSAGE };
  if (resolvedYear === null) return invalidDate(options.mode);

  const maxDay = new Date(Date.UTC(resolvedYear, monthNum, 0)).getUTCDate();
  if (dayNum > maxDay) return invalidDate(options.mode);

  const danish = `${String(dayNum).padStart(2, '0')}-${String(monthNum).padStart(2, '0')}-${String(resolvedYear)}`;
  const iso = coerceToISODateString(danish);
  if (!iso) return invalidDate(options.mode);

  return { ok: true, danish, iso };
};

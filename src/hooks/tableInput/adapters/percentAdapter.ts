import { formatAsAmount } from '../../../utils/formatUtils';
import { parseDanishNumberString } from '../../../utils/numberParsing';
import { formatRoundedCanonical } from '../../../utils/rounding';
import { normalizePercentPaste } from '../../../utils/inputPasteNormalization';
import { filterPercentKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeTableNumericDraftOnCommit } from '../../../utils/tableInputContracts';
import { makePercentFingerprintFromCanonical, type CommittedPayload, type PercentFingerprint } from '../../../types/parserSpec';
import type { TableInputAdapter } from '../tableInputAdapter';

const TABLE_PERCENT_DECIMAL_PRECISION = 2;
const MAX_PERCENT_RAW_LENGTH = 64;
const TABLE_PERCENT_PASTE_MAX = 100;

export type TablePercentInputValue = string | number | undefined;
export type TablePercentInputModel = string;

export type TablePercentAdapterConfig = Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  minValue?: number;
  maxValue?: number;
}>;

type ParsedPercent =
  | Readonly<{ ok: true; numeric: number }>
  | Readonly<{ ok: true; empty: true }>
  | Readonly<{ ok: false; errorMessage: string }>;

const getPercentPrecision = (allowDecimals: boolean): 0 | 2 =>
  allowDecimals ? TABLE_PERCENT_DECIMAL_PRECISION : 0;

export const toPercentDisplayString = (
  value: TablePercentInputValue,
  allowDecimals: boolean
): string => {
  if (value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? formatAsAmount(value, getPercentPrecision(allowDecimals)) : '';
  }
  return value;
};

const parsePercentOnCommit = (
  rawValue: string,
  { allowNegative, allowDecimals, minValue, maxValue }: TablePercentAdapterConfig
): ParsedPercent => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, empty: true };
  if (trimmed === '-') return { ok: false, errorMessage: 'Ugyldig procent' };
  if (trimmed.length > MAX_PERCENT_RAW_LENGTH) return { ok: false, errorMessage: 'Ugyldig procent' };

  const compact = trimmed.replace(/\s+/g, '');
  const isNegative = compact.startsWith('-');
  if (isNegative && !allowNegative) return { ok: false, errorMessage: 'Procent kan ikke være negativ' };

  const unsigned = isNegative ? compact.slice(1) : compact;
  if (unsigned.includes('-')) return { ok: false, errorMessage: 'Ugyldig procent' };
  if (/\s/.test(trimmed) && unsigned.includes('.')) return { ok: false, errorMessage: 'Ugyldig procent' };
  if (!allowDecimals && unsigned.includes(',')) return { ok: false, errorMessage: 'Ugyldig procent' };

  const commaCount = (unsigned.match(/,/g) ?? []).length;
  if (commaCount > 1) return { ok: false, errorMessage: 'Ugyldig procent' };

  const [integerRaw, decimalRaw] = unsigned.split(',') as [string, string | undefined];
  if (!integerRaw) return { ok: false, errorMessage: 'Ugyldig procent' };
  if (decimalRaw !== undefined && decimalRaw === '') return { ok: false, errorMessage: 'Ugyldig procent' };

  if (decimalRaw !== undefined) {
    if (/[^0-9]/.test(decimalRaw)) return { ok: false, errorMessage: 'Ugyldig procent' };
    if (!allowDecimals) return { ok: false, errorMessage: 'Ugyldig procent' };
    if (decimalRaw.length > TABLE_PERCENT_DECIMAL_PRECISION) return { ok: false, errorMessage: 'Ugyldig procent' };
  }

  if (integerRaw.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})*$/.test(integerRaw)) return { ok: false, errorMessage: 'Ugyldig procent' };
  } else if (/[^0-9]/.test(integerRaw)) {
    return { ok: false, errorMessage: 'Ugyldig procent' };
  }

  const numericValue = parseDanishNumberString(`${isNegative ? '-' : ''}${integerRaw}${decimalRaw ? `,${decimalRaw}` : ''}`);
  if (numericValue === undefined) return { ok: false, errorMessage: 'Ugyldig procent' };

  const precision = getPercentPrecision(allowDecimals);
  if (typeof minValue === 'number' && numericValue < minValue) {
    if (typeof maxValue === 'number') {
      return {
        ok: false,
        errorMessage: `Procent skal være mellem ${formatAsAmount(minValue, precision)} og ${formatAsAmount(maxValue, precision)}`,
      };
    }
    return { ok: false, errorMessage: `Procent skal være ${formatAsAmount(minValue, precision)} eller højere` };
  }

  if (typeof maxValue === 'number' && numericValue > maxValue) {
    if (typeof minValue === 'number') {
      return {
        ok: false,
        errorMessage: `Procent skal være mellem ${formatAsAmount(minValue, precision)} og ${formatAsAmount(maxValue, precision)}`,
      };
    }
    return { ok: false, errorMessage: `Procent skal være ${formatAsAmount(maxValue, precision)} eller lavere` };
  }

  return { ok: true, numeric: numericValue };
};

const percentNumericCanonicalFromDisplay = (display: string, allowDecimals: boolean): string => {
  const trimmed = display.trim();
  const withoutPercentSuffix = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
  const parsed = parsePercentOnCommit(withoutPercentSuffix, {
    allowNegative: true,
    allowDecimals,
    minValue: undefined,
    maxValue: undefined,
  });
  if (!parsed.ok) {
    if (import.meta.env.DEV && withoutPercentSuffix !== '') {
      throw new Error(`Invariant brudt: committed procentværdi kan ikke parses (${display})`);
    }
    return '';
  }
  if ('empty' in parsed) return '';
  return formatRoundedCanonical(parsed.numeric, getPercentPrecision(allowDecimals));
};

export const createPercentCommittedPayload = (
  value: TablePercentInputModel,
  allowDecimals: boolean
): CommittedPayload<TablePercentInputModel, string, PercentFingerprint> => {
  const canonical = percentNumericCanonicalFromDisplay(value, allowDecimals);
  return {
    model: value,
    canonical,
    fingerprint: makePercentFingerprintFromCanonical(canonical),
  };
};

export const createPercentTableInputAdapter = (
  config: TablePercentAdapterConfig
): TableInputAdapter<TablePercentInputModel, string, PercentFingerprint> => ({
  format: (value) => value,
  parse: (draft) => {
    const normalized = normalizeTableNumericDraftOnCommit(draft);
    const parsed = parsePercentOnCommit(normalized, config);
    if (!parsed.ok) return { ok: false, errorMessage: parsed.errorMessage };
    if ('empty' in parsed) return { ok: true, value: '' };
    return { ok: true, value: formatAsAmount(parsed.numeric, getPercentPrecision(config.allowDecimals)) };
  },
  toCommittedPayload: (value) => createPercentCommittedPayload(value, config.allowDecimals),
  isValidStartKey: (key) => {
    if (config.allowDecimals) {
      if (!/^[0-9,-]$/.test(key)) return false;
    } else if (!/^[0-9-]$/.test(key)) {
      return false;
    }
    if (key === '-' && !config.allowNegative) return false;
    return true;
  },
  applyPaste: (raw, context) => {
    const normalized = normalizePercentPaste(raw, { maxValue: config.maxValue ?? TABLE_PERCENT_PASTE_MAX });
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    const start = typeof context.selectionStart === 'number' ? context.selectionStart : context.currentDraft.length;
    const end = typeof context.selectionEnd === 'number' ? context.selectionEnd : start;
    const draft = context.currentDraft.slice(0, start) + normalized + context.currentDraft.slice(end);
    return { draft, caretPosition: start + normalized.length };
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    filterPercentKeyDown(e, {
      allowNegative: config.allowNegative,
      allowDecimals: config.allowDecimals,
    });
    return e.defaultPrevented;
  },
  preserveInvalidDraft: true,
  clearErrorOnChange: true,
  useSaveError: true,
});

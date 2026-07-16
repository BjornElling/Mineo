import type { AmountValue } from '../schemas/amountExpressionSchema';
import type { ISODateString } from '../types/branded';
import { coerceToDanishDateString } from '../types/branded';
import {
  trimToNumericEdgesPreserveLeadingMinus,
  trimWhitespaceEdges,
} from '../utils/draftNormalization';
import { getIntegerRangeErrorMessage } from '../utils/integerRange';
import {
  parseAmountInput,
  amountValueToDisplayString,
  amountValueToDraftString,
} from '../utils/expressionAmount';
import { parseIntegerDraftForCommit, type IntegerDraftParseConfig } from '../utils/integerDraftCore';
import { isSafeCanonicalInteger, isSafeCanonicalDecimal, isSafeCanonicalNumber } from '../utils/numericSafety';
import { getNumericBoundsConfigErrors } from '../utils/numericFieldConfig';
import {
  MAX_AMOUNT_INTEGER_DIGITS,
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_RAW_LENGTH,
} from '../utils/amountInputUtils';
import { parseDateDraftForCommit, type DateYearPolicy } from '../utils/dateDraftCommit';
import {
  normalizeAmountPaste,
  normalizeDatePaste,
  normalizeIntegerPaste,
  normalizePercentPaste,
} from '../utils/inputPasteNormalization';
import {
  formatPercentDisplay,
  parsePercentDraftForCommit,
  buildPercentRangeErrorMessage,
  type PercentParseConfig,
} from '../utils/percentDraftCore';
import {
  type FieldCodec,
  type FieldResolution,
  validResolution,
  rejectedResolution,
} from './fieldCodec';

// Greenfield-kerne (§3.3): ét codec pr. inputfamilie, bygget over de EKSISTERENDE godkendte parse-kerner i
// `../utils/*`. Normaliserings-, infer-, præcisions- og paste-regler er UÆNDREDE (§11); den eneste ændring er,
// at en afvist resolution nu bærer en maskinlæsbar `format`/`range`-årsag i stedet for et nøgent `invalid`.

const initialKey = (pattern: RegExp): ((key: string) => boolean) => (key) => pattern.test(key);

const assertBoolean = (codec: string, name: string, value: boolean): void => {
  if (typeof value !== 'boolean') throw new Error(`${codec}: ${name} skal være en boolean`);
};

const assertNumericBounds = (
  codec: string,
  options: Readonly<{ minValue?: number; maxValue?: number; allowNegative?: boolean }>,
  isRepresentable: (value: number) => boolean
): void => {
  const configError = getNumericBoundsConfigErrors(options)[0];
  if (configError !== undefined) throw new Error(`${codec}: ${configError}`);
  for (const [name, value] of [['minValue', options.minValue], ['maxValue', options.maxValue]] as const) {
    if (value !== undefined && !isRepresentable(value)) {
      throw new Error(`${codec}: ${name} kan ikke repræsenteres canonical`);
    }
  }
};

/** Formular- og tabeltekst bruger samme canonical trimning ved settle. Tekst kan aldrig afvises. */
export const textFieldCodec: FieldCodec<string> = Object.freeze({
  parseForSettle: (raw) => validResolution(trimWhitespaceEdges(raw)),
  format: (value) => value,
  formatForEdit: (value) => value,
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Optional fritekst: canonical tomhed er `undefined`, ikke `''`. */
export const optionalTextFieldCodec: FieldCodec<string | undefined> = Object.freeze({
  parseForSettle: (raw) => {
    const trimmed = trimWhitespaceEdges(raw);
    return validResolution(trimmed === '' ? undefined : trimmed);
  },
  format: (value) => value ?? '',
  formatForEdit: (value) => value ?? '',
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Dropdown-/radio-valg. Tom tekst er canonical `undefined`; ukendt tekst afvises som format. */
export const createSelectionFieldCodec = <T extends string | number>(options: Readonly<{
  values: readonly T[];
  formatOption?: (value: T) => string;
}>): FieldCodec<T | undefined> => {
  if (options.values.some((value) => typeof value === 'number' && !isSafeCanonicalNumber(value))) {
    throw new Error('SelectionFieldCodec: numeriske valg skal være endelige og sikkert repræsenterbare');
  }
  const formatOption = options.formatOption ?? String;
  const formatted = options.values.map((value) => ({ value, display: formatOption(value) }));
  if (formatted.some(({ display }) => display === '' || display.trim() !== display)) {
    throw new Error('SelectionFieldCodec: visningstekster skal være ikke-tomme og uden ydre mellemrum');
  }
  const byDisplay = new Map(formatted.map(({ value, display }) => [display, value]));
  if (formatted.length === 0 || byDisplay.size !== formatted.length) {
    throw new Error('SelectionFieldCodec: valgmængden skal være ikke-tom og have entydige visningstekster');
  }
  return Object.freeze({
    parseForSettle: (raw): FieldResolution<T | undefined> => {
      const value = raw.trim();
      if (value === '') return validResolution(undefined);
      const selected = byDisplay.get(value);
      return selected === undefined ? rejectedResolution('format') : validResolution(selected);
    },
    format: (value) => value === undefined ? '' : formatOption(value),
    formatForEdit: (value) => value === undefined ? '' : formatOption(value),
    acceptsInitialKey: () => false,
  });
};

export const createChoiceFieldCodec = <T extends string>(values: readonly T[]): FieldCodec<T | undefined> => {
  if (values.length === 0 || new Set(values).size !== values.length) {
    throw new Error('ChoiceFieldCodec: valgmængden skal være ikke-tom og uden dubletter');
  }
  return createSelectionFieldCodec({ values });
};

export const createRequiredChoiceFieldCodec = <T extends string>(values: readonly T[]): FieldCodec<T> => {
  const optional = createChoiceFieldCodec(values);
  return Object.freeze({
    parseForSettle: (raw): FieldResolution<T> => {
      const resolution = optional.parseForSettle(raw);
      return resolution.status === 'valid' && resolution.value !== undefined
        ? validResolution(resolution.value)
        : rejectedResolution('format');
    },
    format: (value) => optional.format(value),
    formatForEdit: (value) => optional.formatForEdit(value),
    acceptsInitialKey: optional.acceptsInitialKey,
  });
};

/** Toggle/checkbox: immediate-commit-sti, boolean canonical. */
export const booleanFieldCodec: FieldCodec<boolean> = Object.freeze({
  parseForSettle: (raw) => raw === 'true' ? validResolution(true) : raw === 'false' ? validResolution(false) : rejectedResolution('format'),
  format: (value) => String(value),
  formatForEdit: (value) => String(value),
  acceptsInitialKey: () => false,
});

export const createDateFieldCodec = (options: Readonly<{ twoDigitYearPolicy: DateYearPolicy }>): FieldCodec<ISODateString | undefined> =>
  Object.freeze({
    parseForSettle: (raw): FieldResolution<ISODateString | undefined> => {
      const parsed = parseDateDraftForCommit(raw, options);
      // Kun reelt tom tekst er canonical tomhed; anden ikke-parsebar tekst bevares som rejected format.
      return parsed.ok && (parsed.iso !== undefined || raw.trim() === '')
        ? validResolution(parsed.iso)
        : rejectedResolution('format');
    },
    format: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
    formatForEdit: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeDatePaste(raw, options),
  });

export const createIntegerFieldCodec = (
  config: IntegerDraftParseConfig & Readonly<{ minValue?: number; maxValue?: number }>
): FieldCodec<number | undefined> => {
  assertBoolean('IntegerFieldCodec', 'allowNegative', config.allowNegative);
  assertNumericBounds('IntegerFieldCodec', config, isSafeCanonicalInteger);
  return Object.freeze({
    parseForSettle: (raw): FieldResolution<number | undefined> => {
      const edge = trimToNumericEdgesPreserveLeadingMinus(raw);
      const normalized = edge === '' && raw.trim() !== '' ? raw.trim() : edge;
      const parsed = parseIntegerDraftForCommit(normalized, config);
      if (!parsed.ok) return rejectedResolution('format');
      if (parsed.value !== undefined) {
        const rangeMessage = getIntegerRangeErrorMessage(parsed.value, config.minValue, config.maxValue);
        if (rangeMessage !== '') return rejectedResolution('range', boundsDetail(config));
      }
      return validResolution(parsed.value);
    },
    format: (value) => value === undefined ? '' : String(value),
    formatForEdit: (value) => value === undefined ? '' : String(value),
    acceptsInitialKey: (key) => /^\d$/.test(key) || (key === '-' && config.allowNegative),
    normalizePaste: (raw) => normalizeIntegerPaste(raw, {
      allowNegative: config.allowNegative,
      maxDigits: config.maxDigits,
      minValue: config.minValue,
      maxValue: config.maxValue,
    }),
  });
};

export const createAmountFieldCodec = (options: Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  minValue?: number;
  maxValue?: number;
}>): FieldCodec<AmountValue | undefined> => {
  assertBoolean('AmountFieldCodec', 'allowNegative', options.allowNegative);
  assertBoolean('AmountFieldCodec', 'allowDecimals', options.allowDecimals);
  assertNumericBounds('AmountFieldCodec', options, (value) => options.allowDecimals
    ? isSafeCanonicalDecimal(value, DEFAULT_AMOUNT_PRECISION)
    : isSafeCanonicalInteger(value));
  return Object.freeze({
    parseForSettle: (raw): FieldResolution<AmountValue | undefined> => {
      const parsed = parseAmountInput(raw, {
        precision: DEFAULT_AMOUNT_PRECISION,
        allowNegative: options.allowNegative,
        allowDecimals: options.allowDecimals,
        maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
        maxRawLength: MAX_AMOUNT_RAW_LENGTH,
      });
      if (!parsed.ok || (parsed.value === undefined && raw.trim() !== '')) return rejectedResolution('format');
      const numericValue = parsed.value?.value;
      if (numericValue !== undefined && (
        (options.minValue !== undefined && numericValue < options.minValue)
        || (options.maxValue !== undefined && numericValue > options.maxValue)
      )) return rejectedResolution('range', boundsDetail(options));
      return validResolution(parsed.value);
    },
    format: (value) => amountValueToDisplayString(value, DEFAULT_AMOUNT_PRECISION),
    formatForEdit: (value) => amountValueToDraftString(value, DEFAULT_AMOUNT_PRECISION),
    acceptsInitialKey: (key) => /^[0-9,()-]$/.test(key) && (key !== '-' || options.allowNegative),
    normalizePaste: (raw) => normalizeAmountPaste(raw, {
      allowNegative: options.allowNegative,
      allowDecimals: options.allowDecimals,
      maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
      maxDecimalDigits: DEFAULT_AMOUNT_PRECISION,
      maxRawLength: MAX_AMOUNT_RAW_LENGTH,
      minValue: options.minValue,
      maxValue: options.maxValue,
    }),
  });
};

export const createPercentFieldCodec = (config: PercentParseConfig): FieldCodec<number | undefined> => {
  assertBoolean('PercentFieldCodec', 'allowNegative', config.allowNegative);
  assertBoolean('PercentFieldCodec', 'allowDecimals', config.allowDecimals);
  assertNumericBounds('PercentFieldCodec', config, (value) => config.allowDecimals
    ? isSafeCanonicalDecimal(value, 2)
    : isSafeCanonicalInteger(value));
  const formatOnlyConfig: PercentParseConfig = { ...config, minValue: undefined, maxValue: undefined };
  return Object.freeze({
    parseForSettle: (raw): FieldResolution<number | undefined> => {
      // Format og range adskilles eksplicit: parse uden grænser, derefter range-check (§1.6/§3.3).
      const parsed = parsePercentDraftForCommit(raw, formatOnlyConfig);
      if (!parsed.ok) return rejectedResolution('format');
      if (parsed.value !== undefined && buildPercentRangeErrorMessage(parsed.value, config) !== null) {
        return rejectedResolution('range', boundsDetail(config));
      }
      return validResolution(parsed.value);
    },
    format: (value) => formatPercentDisplay(value, config.allowDecimals),
    formatForEdit: (value) => formatPercentDisplay(value, config.allowDecimals),
    acceptsInitialKey: (key) => (config.allowDecimals ? /^[0-9,-]$/ : /^[0-9-]$/).test(key)
      && (key !== '-' || config.allowNegative),
    normalizePaste: (raw) => normalizePercentPaste(raw, {
      allowNegative: config.allowNegative,
      allowDecimals: config.allowDecimals,
      minValue: config.minValue,
      maxValue: config.maxValue,
    }),
  });
};

const boundsDetail = (options: Readonly<{ minValue?: number; maxValue?: number }>): Readonly<Record<string, number>> => {
  const detail: Record<string, number> = {};
  if (options.minValue !== undefined) detail.minValue = options.minValue;
  if (options.maxValue !== undefined) detail.maxValue = options.maxValue;
  return detail;
};

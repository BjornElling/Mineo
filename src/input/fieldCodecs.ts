import type { AmountValue } from '../schemas/amountExpressionSchema';
import type { ISODateString } from '../types/branded';
import { coerceToDanishDateString } from '../types/branded';
import { trimWhitespaceEdges } from '../utils/draftNormalization';
import { parseAmountInput, amountValueToDisplayString } from '../utils/expressionAmount';
import { parseFractionString, type FractionParseOptions } from '../utils/fraction';
import { parseIntegerDraftForCommit, type IntegerDraftParseConfig } from '../utils/integerDraftCore';
import {
  MAX_AMOUNT_INTEGER_DIGITS,
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_RAW_LENGTH,
  normalizePastedAmount,
} from '../utils/amountInputUtils';
import { parseDateDraftForCommit, type DateYearPolicy } from '../utils/dateDraftCommit';
import { normalizeDatePaste, normalizePercentPaste } from '../utils/inputPasteNormalization';
import {
  formatPercentDisplay,
  parsePercentDraftForCommit,
  type PercentParseConfig,
} from '../utils/percentDraftCore';
import { parseWeekDraftForCommit, type WeekDraftParseConfig } from '../utils/weekDraftCore';
import { parseYearDraftForCommit, type YearDraftParseConfig } from '../utils/yearDraftCore';
import type { FieldCodec, FieldResolution } from './fieldDefinition';

const valid = <T>(value: T): FieldResolution<T> => ({ status: 'valid', value });
const invalid = <T>(): FieldResolution<T> => ({ status: 'invalid' });

const initialKey = (pattern: RegExp): ((key: string) => boolean) => (key) => pattern.test(key);

/** Codec for rå tekst. Valgfri trimning gør tidligere form- og tabeladfærd eksplicit ved bindingen. */
export const createTextFieldCodec = (options: Readonly<{ trim?: boolean }> = {}): FieldCodec<string> => Object.freeze({
  parseForSettle: (raw) => valid(options.trim === true ? trimWhitespaceEdges(raw) : raw),
  format: (value) => value,
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Dropdown- og radio-værdier parses mod controllets eksplicitte canonical valg. */
export const createSelectionFieldCodec = <T extends string | number>(options: Readonly<{
  values: readonly T[];
  formatOption?: (value: T) => string;
}>): FieldCodec<T | undefined> => {
  const formatOption = options.formatOption ?? String;
  const byDisplayValue = new Map(options.values.map((value) => [formatOption(value), value]));
  if (options.values.length === 0 || byDisplayValue.size !== options.values.length) {
    throw new Error('SelectionFieldCodec: valgmængden skal være ikke-tom og have entydige visningstekster');
  }
  return Object.freeze({
    parseForSettle: (raw) => {
      const value = raw.trim();
      return value === '' ? valid(undefined) : byDisplayValue.has(value) ? valid(byDisplayValue.get(value) as T) : invalid();
    },
    format: (value) => value === undefined ? '' : formatOption(value),
    acceptsInitialKey: () => false,
  });
};

/** Kortform til de almindelige tekstbaserede Ja/Nej- og radiovalg. */
export const createChoiceFieldCodec = <T extends string>(values: readonly T[]): FieldCodec<T | undefined> => {
  if (values.length === 0 || new Set(values).size !== values.length) {
    throw new Error('ChoiceFieldCodec: valgmængden skal være ikke-tom og uden dubletter');
  }
  return createSelectionFieldCodec({ values });
};

/** Toggle og checkbox bruger samme immediate-commit-sti, men bevarer boolean som canonical værdi. */
export const booleanFieldCodec: FieldCodec<boolean> = Object.freeze({
  parseForSettle: (raw) => raw === 'true' ? valid(true) : raw === 'false' ? valid(false) : invalid(),
  format: (value) => String(value),
  acceptsInitialKey: () => false,
});

export const createDateFieldCodec = (options: Readonly<{ twoDigitYearPolicy: DateYearPolicy }>): FieldCodec<ISODateString | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const parsed = parseDateDraftForCommit(raw, options);
    return parsed.ok ? valid(parsed.iso) : invalid();
  },
  format: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
  acceptsInitialKey: initialKey(/^\d$/),
  normalizePaste: normalizeDatePaste,
});

export const createAmountFieldCodec = (options: Readonly<{ allowNegative: boolean }>): FieldCodec<AmountValue | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const parsed = parseAmountInput(raw, {
      precision: DEFAULT_AMOUNT_PRECISION,
      allowNegative: options.allowNegative,
      maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
      maxRawLength: MAX_AMOUNT_RAW_LENGTH,
    });
    return parsed.ok ? valid(parsed.value) : invalid();
  },
  format: (value) => amountValueToDisplayString(value, DEFAULT_AMOUNT_PRECISION),
  acceptsInitialKey: (key) => /^[0-9,()-]$/.test(key) && (key !== '-' || options.allowNegative),
  normalizePaste: normalizePastedAmount,
});

export const createPercentFieldCodec = (config: PercentParseConfig): FieldCodec<number | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const parsed = parsePercentDraftForCommit(raw, config);
    return parsed.ok ? valid(parsed.value) : invalid();
  },
  format: (value) => formatPercentDisplay(value, config.allowDecimals),
  acceptsInitialKey: (key) => (config.allowDecimals ? /^[0-9,-]$/ : /^[0-9-]$/).test(key)
    && (key !== '-' || config.allowNegative),
  normalizePaste: (raw) => normalizePercentPaste(raw, { maxValue: config.maxValue }),
});

export const createIntegerFieldCodec = (config: IntegerDraftParseConfig): FieldCodec<number | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const parsed = parseIntegerDraftForCommit(raw, config);
    return parsed.ok ? valid(parsed.value) : invalid();
  },
  format: (value) => value === undefined ? '' : String(value),
  acceptsInitialKey: (key) => /^\d$/.test(key) || (key === '-' && config.allowNegative),
});

export const createYearFieldCodec = (config: YearDraftParseConfig): FieldCodec<number | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const parsed = parseYearDraftForCommit(raw, config);
    return parsed.ok ? valid(parsed.value) : invalid();
  },
  format: (value) => value === undefined ? '' : String(value),
  acceptsInitialKey: initialKey(/^\d$/),
});

export const createWeekFieldCodec = (config: WeekDraftParseConfig): FieldCodec<string | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const parsed = parseWeekDraftForCommit(raw, config);
    return parsed.ok ? valid(parsed.value) : invalid();
  },
  format: (value) => value ?? '',
  acceptsInitialKey: initialKey(/^\d$/),
});

export const createFractionFieldCodec = (config: FractionParseOptions): FieldCodec<string | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const trimmed = raw.trim();
    if (trimmed === '') return valid(undefined);
    const parsed = parseFractionString(trimmed, config);
    return parsed.ok ? valid(parsed.parsed.value) : invalid();
  },
  format: (value) => value ?? '',
  acceptsInitialKey: (key) => /^[0-9/,]$/.test(key) || (key === '-' && config.allowNegative === true),
});

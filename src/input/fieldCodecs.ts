import type { AmountValue } from '../schemas/amountExpressionSchema';
import type { ISODateString } from '../types/branded';
import { coerceToDanishDateString } from '../types/branded';
import {
  trimToAlphanumericEdges,
  trimToNumericEdgesPreserveLeadingMinus,
  trimWhitespaceEdges,
} from '../utils/draftNormalization';
import { getIntegerRangeErrorMessage } from '../utils/integerRange';
import {
  parseAmountInput,
  amountValueToDisplayString,
  amountValueToDraftString,
} from '../utils/expressionAmount';
import { parseFractionString, type FractionParseOptions } from '../utils/fraction';
import { parseIntegerDraftForCommit, type IntegerDraftParseConfig } from '../utils/integerDraftCore';
import {
  isSafeCanonicalDecimal,
  isSafeCanonicalInteger,
  isSafeCanonicalNumber,
} from '../utils/numericSafety';
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
  normalizeFractionPaste,
  normalizeIntegerPaste,
  normalizePercentPaste,
  normalizeWeekPaste,
  normalizeYearPaste,
} from '../utils/inputPasteNormalization';
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

const assertBooleanConfig = (codec: string, name: string, value: boolean): void => {
  if (typeof value !== 'boolean') {
    throw new Error(`${codec}: ${name} skal være en boolean`);
  }
};

const assertOptionalPositiveIntegerConfig = (codec: string, name: string, value: number | undefined): void => {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    throw new Error(`${codec}: ${name} skal være et positivt heltal`);
  }
};

const assertOptionalBooleanConfig = (codec: string, name: string, value: boolean | undefined): void => {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`${codec}: ${name} skal være en boolean`);
  }
};

const assertYearPolicyConfig = (codec: string, value: DateYearPolicy): void => {
  if (value !== 'reject' && value !== 'infer' && value !== 'assume20xx') {
    throw new Error(`${codec}: ukendt politik for tocifrede år`);
  }
};

const assertNumericBoundsConfig = (
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

/** Formular- og tabeltekst bruger samme canonical trimning ved settle. */
export const textFieldCodec: FieldCodec<string> = Object.freeze({
  parseForSettle: (raw) => valid(trimWhitespaceEdges(raw)),
  format: (value) => value,
  formatForEdit: (value) => value,
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Bevarer factory-API'et for feltdefinitioner, men returnerer den ene immutable tekstcodec. */
export const createTextFieldCodec = (): FieldCodec<string> => textFieldCodec;

/**
 * Optional fritekst: canonical tomhed er `undefined`, ikke den tomme streng. Bruges af alle
 * `optionalString`-felter (fx stamdata-initialer, kommentarer), så tom tekst ikke persisteres som `''`.
 */
export const createOptionalTextFieldCodec = (): FieldCodec<string | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const trimmed = trimWhitespaceEdges(raw);
    return valid(trimmed === '' ? undefined : trimmed);
  },
  format: (value) => value ?? '',
  formatForEdit: (value) => value ?? '',
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Dropdown- og radio-værdier parses mod controllets eksplicitte canonical valg. */
export const createSelectionFieldCodec = <T extends string | number>(options: Readonly<{
  values: readonly T[];
  formatOption?: (value: T) => string;
}>): FieldCodec<T | undefined> => {
  if (options.values.some((value) => typeof value === 'number' && !isSafeCanonicalNumber(value))) {
    throw new Error('SelectionFieldCodec: numeriske valg skal være endelige og sikkert repræsenterbare');
  }
  const formatOption = options.formatOption ?? String;
  const formattedOptions = options.values.map((value) => ({ value, display: formatOption(value) }));
  if (formattedOptions.some(({ display }) => display === '' || display.trim() !== display)) {
    throw new Error('SelectionFieldCodec: visningstekster skal være ikke-tomme og uden ydre mellemrum');
  }
  const byDisplayValue = new Map(formattedOptions.map(({ value, display }) => [display, value]));
  if (formattedOptions.length === 0 || byDisplayValue.size !== formattedOptions.length) {
    throw new Error('SelectionFieldCodec: valgmængden skal være ikke-tom og have entydige visningstekster');
  }
  return Object.freeze({
    parseForSettle: (raw) => {
      const value = raw.trim();
      if (value === '') return valid(undefined);
      const selected = byDisplayValue.get(value);
      return selected === undefined ? invalid() : valid(selected);
    },
    format: (value) => value === undefined ? '' : formatOption(value),
    formatForEdit: (value) => value === undefined ? '' : formatOption(value),
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

/** Påkrævede dropdown-/radiovalg afviser tom tekst i stedet for at producere `undefined`. */
export const createRequiredChoiceFieldCodec = <T extends string>(values: readonly T[]): FieldCodec<T> => {
  const optionalCodec = createChoiceFieldCodec(values);
  return Object.freeze({
    parseForSettle: (raw) => {
      const resolution = optionalCodec.parseForSettle(raw);
      return resolution.status === 'valid' && resolution.value !== undefined
        ? valid(resolution.value)
        : invalid();
    },
    format: optionalCodec.format,
    formatForEdit: optionalCodec.formatForEdit,
    acceptsInitialKey: optionalCodec.acceptsInitialKey,
  });
};

/** Toggle og checkbox bruger samme immediate-commit-sti, men bevarer boolean som canonical værdi. */
export const booleanFieldCodec: FieldCodec<boolean> = Object.freeze({
  parseForSettle: (raw) => raw === 'true' ? valid(true) : raw === 'false' ? valid(false) : invalid(),
  format: (value) => String(value),
  formatForEdit: (value) => String(value),
  acceptsInitialKey: () => false,
});

export const createDateFieldCodec = (options: Readonly<{ twoDigitYearPolicy: DateYearPolicy }>): FieldCodec<ISODateString | undefined> => {
  assertYearPolicyConfig('DateFieldCodec', options.twoDigitYearPolicy);
  return Object.freeze({
    parseForSettle: (raw) => {
      const parsed = parseDateDraftForCommit(raw, options);
      // Legacy-parseren behandler bl.a. "0" og specialtegn som clear. I inputaggregaten er kun
      // reelt tom tekst canonical tomhed; ikke-tom tekst skal bevares som rejected input.
      return parsed.ok && (parsed.iso !== undefined || raw.trim() === '') ? valid(parsed.iso) : invalid();
    },
    format: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
    formatForEdit: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeDatePaste(raw, options),
  });
};

export const createAmountFieldCodec = (options: Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  minValue?: number;
  maxValue?: number;
}>): FieldCodec<AmountValue | undefined> => {
  assertBooleanConfig('AmountFieldCodec', 'allowNegative', options.allowNegative);
  assertBooleanConfig('AmountFieldCodec', 'allowDecimals', options.allowDecimals);
  assertNumericBoundsConfig(
    'AmountFieldCodec',
    options,
    (value) => options.allowDecimals
      ? isSafeCanonicalDecimal(value, DEFAULT_AMOUNT_PRECISION)
      : isSafeCanonicalInteger(value)
  );
  return Object.freeze({
    parseForSettle: (raw) => {
      const parsed = parseAmountInput(raw, {
        precision: DEFAULT_AMOUNT_PRECISION,
        allowNegative: options.allowNegative,
        allowDecimals: options.allowDecimals,
        maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
        maxRawLength: MAX_AMOUNT_RAW_LENGTH,
      });
      // Et ikke-tomt beløbsudtryk uden cifre er ugyldigt, ikke en implicit rydning af feltet.
      if (!parsed.ok || (parsed.value === undefined && raw.trim() !== '')) return invalid();
      const numericValue = parsed.value?.value;
      if (
        numericValue !== undefined
        && (
          (options.minValue !== undefined && numericValue < options.minValue)
          || (options.maxValue !== undefined && numericValue > options.maxValue)
        )
      ) return invalid();
      return valid(parsed.value);
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
  assertBooleanConfig('PercentFieldCodec', 'allowNegative', config.allowNegative);
  assertBooleanConfig('PercentFieldCodec', 'allowDecimals', config.allowDecimals);
  assertNumericBoundsConfig(
    'PercentFieldCodec',
    config,
    (value) => config.allowDecimals
      ? isSafeCanonicalDecimal(value, 2)
      : isSafeCanonicalInteger(value)
  );
  return Object.freeze({
    parseForSettle: (raw) => {
      const parsed = parsePercentDraftForCommit(raw, config);
      return parsed.ok ? valid(parsed.value) : invalid();
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

export const createIntegerFieldCodec = (
  config: IntegerDraftParseConfig & Readonly<{ minValue?: number; maxValue?: number }>
): FieldCodec<number | undefined> => {
  assertBooleanConfig('IntegerFieldCodec', 'allowNegative', config.allowNegative);
  assertOptionalPositiveIntegerConfig('IntegerFieldCodec', 'maxDigits', config.maxDigits);
  assertNumericBoundsConfig('IntegerFieldCodec', config, isSafeCanonicalInteger);
  return Object.freeze({
    parseForSettle: (raw) => {
      const edgeNormalized = trimToNumericEdgesPreserveLeadingMinus(raw);
      // Kantnormalisering må ikke forvandle ikke-tom, ikke-numerisk tekst til canonical tomhed.
      // Bevar råteksten i den gren, så parseren afviser den og rejected input ikke går tabt.
      const normalized = edgeNormalized === '' && raw.trim() !== '' ? raw.trim() : edgeNormalized;
      const parsed = parseIntegerDraftForCommit(normalized, config);
      if (!parsed.ok) return invalid();
      if (
        parsed.value !== undefined
        && getIntegerRangeErrorMessage(parsed.value, config.minValue, config.maxValue) !== ''
      ) return invalid();
      return valid(parsed.value);
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

/**
 * Bevarer et eksisterende strengbaseret canonical schema omkring et fælles tal-/ugecodec.
 * Standardløn-tabellens periodefelter er historisk persisteret som tekst. Adapteren genbruger
 * derfor parser, starttegn og paste-regler uden at ændre `.eo`-repræsentationen eller indføre
 * parallel parsing.
 */
export const createStringBackedFieldCodec = <T extends string | number>(
  sourceCodec: FieldCodec<T | undefined>
): FieldCodec<string | undefined> => Object.freeze({
  parseForSettle: (raw) => {
    const resolution = sourceCodec.parseForSettle(raw);
    if (resolution.status === 'invalid') return invalid();
    // Standardløn-rækker har historisk persisteret ryddede periodeceller som `""`.
    // Bevar denne canonical tomhed byte-for-byte i `.eo` i stedet for at skrive `undefined`.
    return valid(resolution.value === undefined ? '' : String(resolution.value));
  },
  // Schemaet har historisk tilladt vilkårlige strenge. Visningen må derfor bevare en indlæst
  // legacy-værdi ordret; først næste settle canonicaliserer gennem kildecodecet.
  format: (value) => value ?? '',
  formatForEdit: (value) => value ?? '',
  acceptsInitialKey: sourceCodec.acceptsInitialKey,
  ...(sourceCodec.normalizePaste === undefined
    ? {}
    : { normalizePaste: sourceCodec.normalizePaste }),
});

export const createYearFieldCodec = (config: YearDraftParseConfig): FieldCodec<number | undefined> => {
  assertYearPolicyConfig('YearFieldCodec', config.twoDigitYearPolicy);
  assertNumericBoundsConfig('YearFieldCodec', {
    minValue: config.minYear,
    maxValue: config.maxYear,
    allowNegative: false,
  }, isSafeCanonicalInteger);
  return Object.freeze({
    parseForSettle: (raw) => {
      const parsed = parseYearDraftForCommit(trimToAlphanumericEdges(raw), config);
      return parsed.ok ? valid(parsed.value) : invalid();
    },
    format: (value) => value === undefined ? '' : String(value),
    formatForEdit: (value) => value === undefined ? '' : String(value),
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeYearPaste(raw, config),
  });
};

export const createWeekFieldCodec = (config: WeekDraftParseConfig): FieldCodec<string | undefined> => {
  assertOptionalPositiveIntegerConfig('WeekFieldCodec', 'maxDraftLength', config.maxDraftLength);
  assertYearPolicyConfig('WeekFieldCodec', config.twoDigitYearPolicy);
  assertNumericBoundsConfig('WeekFieldCodec', {
    minValue: config.minYear,
    maxValue: config.maxYear,
    allowNegative: false,
  }, isSafeCanonicalInteger);
  return Object.freeze({
    parseForSettle: (raw) => {
      const parsed = parseWeekDraftForCommit(trimToAlphanumericEdges(raw), config);
      return parsed.ok ? valid(parsed.value) : invalid();
    },
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeWeekPaste(raw, config),
  });
};

export const createFractionFieldCodec = (config: FractionParseOptions): FieldCodec<string | undefined> => {
  assertOptionalPositiveIntegerConfig('FractionFieldCodec', 'maxDigits', config.maxDigits);
  assertOptionalBooleanConfig('FractionFieldCodec', 'allowNegative', config.allowNegative);
  assertOptionalBooleanConfig('FractionFieldCodec', 'allowZeroNumerator', config.allowZeroNumerator);
  assertOptionalBooleanConfig('FractionFieldCodec', 'canonicalizeOnCommit', config.canonicalizeOnCommit);
  assertOptionalBooleanConfig('FractionFieldCodec', 'requireIntegerFraction', config.requireIntegerFraction);
  return Object.freeze({
    parseForSettle: (raw) => {
      // Samme edge-normalisering som StyledFractionField's `normalizeDraftOnCommit`
      // (`trimToAlphanumericEdges`), så codecet er den fælles raw→canonical-kilde for
      // form og en evt. senere typed-commit-sti: begge afskærer ikke-alfanumeriske kanttegn
      // (fx omsluttende parenteser/mellemrum) før parse, i stedet for kun whitespace.
      const trimmed = trimToAlphanumericEdges(raw);
      if (trimmed === '') return valid(undefined);
      const parsed = parseFractionString(trimmed, config);
      return parsed.ok ? valid(parsed.parsed.value) : invalid();
    },
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => /^[0-9/,]$/.test(key) || (key === '-' && config.allowNegative === true),
    normalizePaste: (raw) => normalizeFractionPaste(raw, config),
  });
};

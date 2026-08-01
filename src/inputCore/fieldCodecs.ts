import type { AmountValue } from '../schemas/amountExpressionSchema';
import type { ISODateString } from '../types/branded';
import { coerceToDanishDateString } from '../types/branded';
import {
  trimToAlphanumericEdges,
  trimToNumericEdgesPreserveLeadingMinus,
  trimWhitespaceEdges,
} from '../utils/draftNormalization';
import {
  parseAmountInput,
  amountValueToDisplayString,
  amountValueToDraftString,
} from '../utils/expressionAmount';
import { parseIntegerDraftForCommit, type IntegerDraftParseConfig } from '../utils/integerDraftCore';
import { parseFractionString, type FractionParseOptions } from '../utils/fraction';
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
import {
  type FieldCodec,
  type FieldResolution,
  validResolution,
  rejectedResolution,
} from './fieldCodec';

// Inputkernen (§3.3): ét codec pr. inputfamilie, bygget over de EKSISTERENDE godkendte parse-kerner i
// `../utils/*`. Normaliserings-, infer-, præcisions- og paste-regler er UÆNDREDE (§11). Efter kravændringen
// 2026-07-18 afviser et codec KUN ugyldigt format/schema-urepræsenterbarhed; en schema-gyldig værdi uden for
// feltets aktive min/max committes canonical og bærer et afledt bounds-issue fra en feltvalidator (§1.6).
// Paste-normaliseringen beholder sin min/max-clamp — kun commit-tidens range-afvisning er fjernet.

const initialKey = (pattern: RegExp): ((key: string) => boolean) => (key) => pattern.test(key);

const assertBoolean = (codec: string, name: string, value: boolean): void => {
  if (typeof value !== 'boolean') throw new Error(`${codec}: ${name} skal være en boolean`);
};

const assertOptionalBoolean = (codec: string, name: string, value: boolean | undefined): void => {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`${codec}: ${name} skal være en boolean`);
  }
};

const assertPositiveInteger = (codec: string, name: string, value: number | undefined): void => {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    throw new Error(`${codec}: ${name} skal være et positivt heltal`);
  }
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
  family: 'text',
  parseForSettle: (raw) => validResolution(trimWhitespaceEdges(raw)),
  format: (value) => value,
  formatForEdit: (value) => value,
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Factory-form af {@link textFieldCodec}, så descriptor-moduler kan læse ensartet `create*`-stil. */
export const createTextFieldCodec = (): FieldCodec<string> => textFieldCodec;

/** Optional fritekst: canonical tomhed er `undefined`, ikke `''`. */
export const optionalTextFieldCodec: FieldCodec<string | undefined> = Object.freeze({
  family: 'optionalText',
  parseForSettle: (raw) => {
    const trimmed = trimWhitespaceEdges(raw);
    return validResolution(trimmed === '' ? undefined : trimmed);
  },
  format: (value) => value ?? '',
  formatForEdit: (value) => value ?? '',
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Factory-form af {@link optionalTextFieldCodec}, så descriptor-moduler kan læse ensartet `create*`-stil. */
export const createOptionalTextFieldCodec = (): FieldCodec<string | undefined> => optionalTextFieldCodec;

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
    family: 'selection',
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

export const createRequiredChoiceFieldCodec = <T extends string>(
  values: readonly T[],
  emptyValue: T
): FieldCodec<T> => {
  const optional = createChoiceFieldCodec(values);
  if (!values.includes(emptyValue)) {
    throw new Error('RequiredChoiceFieldCodec: tomværdien skal findes i valgmængden');
  }
  return Object.freeze({
    family: 'requiredChoice',
    parseForSettle: (raw): FieldResolution<T> => {
      if (raw.trim() === '') return validResolution(emptyValue);
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
export const createBooleanFieldCodec = (emptyValue = false): FieldCodec<boolean> => Object.freeze({
  family: 'boolean',
  parseForSettle: (raw) => raw.trim() === ''
    ? validResolution(emptyValue)
    : raw === 'true'
      ? validResolution(true)
      : raw === 'false'
        ? validResolution(false)
        : rejectedResolution('format'),
  format: (value) => String(value),
  formatForEdit: (value) => String(value),
  acceptsInitialKey: () => false,
});

export const booleanFieldCodec: FieldCodec<boolean> = createBooleanFieldCodec(false);

export const createDateFieldCodec = (options: Readonly<{ twoDigitYearPolicy: DateYearPolicy }>): FieldCodec<ISODateString | undefined> =>
  Object.freeze({
    family: 'date',
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
    family: 'integer',
    // Fortegns-politikken er DATA, så feltkomponenternes tegnfilter kan læse den erklærede regel
    // frem for at hardkode sin egen. Parse/settle nedenfor er fortsat fortegns-blind (§1.6).
    signPolicy: config.allowNegative ? 'signed' : 'nonNegative',
    parseForSettle: (raw): FieldResolution<number | undefined> => {
      const edge = trimToNumericEdgesPreserveLeadingMinus(raw);
      const normalized = edge === '' && raw.trim() !== '' ? raw.trim() : edge;
      // Fortegn, cifferantal og min/max er feltgrænser, ikke schema-repræsenterbarhed. Parse derfor ethvert
      // sikkert heltal; descriptorens canonical validator ejer den røde bounds-fejl (§1.6).
      const parsed = parseIntegerDraftForCommit(normalized, { allowNegative: true });
      if (!parsed.ok) return rejectedResolution('format');
      return validResolution(parsed.value);
    },
    format: (value) => value === undefined ? '' : String(value),
    formatForEdit: (value) => value === undefined ? '' : String(value),
    // Minus åbner kun editoren på et felt, der FÅR være negativt.
    acceptsInitialKey: (key) => /^\d$/.test(key) || (key === '-' && config.allowNegative),
    // Paste beholder BEVIDST `allowNegative: true`: en INDSAT negativ værdi skal committes canonical og bære
    // sit røde bounds-issue (§1.6), ikke få fortegnet stille fjernet. Tegnfilteret gælder tastning — det
    // forhindrer indtastningen, mens paste aldrig må ændre data i tavshed.
    normalizePaste: (raw) => normalizeIntegerPaste(raw, {
      allowNegative: true,
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
  // `allowDecimals` styrer BÅDE hvad der kan indtastes og hvordan værdien vises: et felt, der afviser
  // decimaler, må heller ikke vise en decimalkomma-hale, den brugeren ikke kan skrive eller rette. Derfor
  // udledes visnings-præcisionen af flaget frem for at være hardkodet til 2 (jf. procent-codec'en, der
  // altid har tråret sit `allowDecimals` igennem til `format`). Med præcision 0 udelader `formatAsAmount`
  // kommaet helt.
  const displayPrecision = options.allowDecimals ? DEFAULT_AMOUNT_PRECISION : 0;
  return Object.freeze({
    family: 'amount',
    // Se `FieldSignPolicy`: den erklærede fortegnsregel er data, så tegnfilteret ikke gætter.
    signPolicy: options.allowNegative ? 'signed' : 'nonNegative',
    parseForSettle: (raw): FieldResolution<AmountValue | undefined> => {
      const parsed = parseAmountInput(raw, {
        precision: displayPrecision,
        // Fortegn er en canonical bounds-regel; parseren afviser kun format og sikker repræsentation.
        allowNegative: true,
        allowDecimals: options.allowDecimals,
        maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
        maxRawLength: MAX_AMOUNT_RAW_LENGTH,
      });
      // Kun format/schema-repræsenterbarhed afvises (§1.6). Aktive min/max vurderes af en canonical
      // feltvalidator på den committede værdi, ikke som en rejection her.
      if (!parsed.ok || (parsed.value === undefined && raw.trim() !== '')) return rejectedResolution('format');
      return validResolution(parsed.value);
    },
    format: (value) => amountValueToDisplayString(value, displayPrecision),
    formatForEdit: (value) => amountValueToDraftString(value, displayPrecision),
    // Et komma må kun åbne editoren i et felt, der faktisk kan rumme decimaler — ellers ville
    // tastetrykket starte en redigering, som tegnfilteret straks blokerer.
    //
    // `-` beholdes for BEGGE fortegns-politikker, i modsætning til heltal og procent: i et
    // beløbsfelt er minus også SUBTRAKTION i et udtryk ("5000-200"), og et ikke-negativt felt må gerne
    // regne sig ned til et lovligt resultat. Tegnfilteret blokerer netop kun det UNÆRE minus
    // (`containsUnaryMinusToken`), og den skelnen kan et enkelt-tegns-opslag ikke gøre.
    acceptsInitialKey: (key) => (options.allowDecimals ? /^[0-9,()-]$/ : /^[0-9()-]$/).test(key),
    normalizePaste: (raw) => normalizeAmountPaste(raw, {
      allowNegative: true,
      allowDecimals: options.allowDecimals,
      maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
      maxDecimalDigits: displayPrecision,
      maxRawLength: MAX_AMOUNT_RAW_LENGTH,
    }),
  });
};

export const createPercentFieldCodec = (config: PercentParseConfig): FieldCodec<number | undefined> => {
  assertBoolean('PercentFieldCodec', 'allowNegative', config.allowNegative);
  assertBoolean('PercentFieldCodec', 'allowDecimals', config.allowDecimals);
  assertNumericBounds('PercentFieldCodec', config, (value) => config.allowDecimals
    ? isSafeCanonicalDecimal(value, 2)
    : isSafeCanonicalInteger(value));
  const formatOnlyConfig: PercentParseConfig = {
    ...config,
    allowNegative: true,
    minValue: undefined,
    maxValue: undefined,
  };
  return Object.freeze({
    family: 'percent',
    // Se `FieldSignPolicy`. ALLE procentfelter i produktionskataloget er `nonNegative`; politikken er
    // alligevel udledt af konfigurationen frem for hardkodet, så et fremtidigt fortegnet procentfelt virker.
    signPolicy: config.allowNegative ? 'signed' : 'nonNegative',
    decimalPolicy: config.allowDecimals ? 'decimal' : 'integerOnly',
    parseForSettle: (raw): FieldResolution<number | undefined> => {
      // Kun format afvises (§1.6/§3.3): parse uden grænser. En schema-gyldig out-of-bounds-procent committes
      // canonical; min/max vurderes af en canonical feltvalidator, ikke som en rejection her.
      const parsed = parsePercentDraftForCommit(raw, formatOnlyConfig);
      if (!parsed.ok) return rejectedResolution('format');
      return validResolution(parsed.value);
    },
    format: (value) => formatPercentDisplay(value, config.allowDecimals),
    formatForEdit: (value) => formatPercentDisplay(value, config.allowDecimals),
    // Minus åbner kun editoren, hvis feltet FÅR være negativt. En procent har ingen udtryks-syntaks,
    // så her er minus utvetydigt et fortegn — modsat beløbsfeltets subtraktion.
    acceptsInitialKey: (key) => {
      if (key === '-') return config.allowNegative;
      return (config.allowDecimals ? /^[0-9,]$/ : /^[0-9]$/).test(key);
    },
    normalizePaste: (raw) => normalizePercentPaste(raw, {
      allowNegative: true,
      allowDecimals: config.allowDecimals,
    }),
  });
};

/** Adapter til eksisterende string-backed periodefelter; tomhed bevares som `''` i canonical data. */
export const createStringBackedFieldCodec = <T extends string | number>(
  sourceCodec: FieldCodec<T | undefined>
): FieldCodec<string | undefined> => Object.freeze({
  family: 'stringBacked',
  parseForSettle: (raw) => {
    const resolution = sourceCodec.parseForSettle(raw);
    if (resolution.status === 'rejected') {
      return rejectedResolution(resolution.reason, resolution.detail);
    }
    return validResolution(resolution.value === undefined ? '' : String(resolution.value));
  },
  // Tolerant `.eo`-load kan have bevaret en historisk streng. Den canonicaliseres først ved næste settle.
  format: (value) => value ?? '',
  formatForEdit: (value) => value ?? '',
  acceptsInitialKey: sourceCodec.acceptsInitialKey,
  // Fortegns-politikken ARVES fra det indre codec: adapteren ændrer kun canonical TOMHED til `''`,
  // ikke hvad der er et lovligt fortegn. Uden viderestillingen ville månedscellen — et heltal 1..12 gennem
  // denne adapter — miste sin ikke-negative politik og få minus tilbage i tegnfilteret.
  ...(sourceCodec.signPolicy === undefined ? {} : { signPolicy: sourceCodec.signPolicy }),
  ...(sourceCodec.normalizePaste === undefined ? {} : { normalizePaste: sourceCodec.normalizePaste }),
});

export const createYearFieldCodec = (config: YearDraftParseConfig): FieldCodec<number | undefined> => {
  assertNumericBounds('YearFieldCodec', {
    minValue: config.minYear,
    maxValue: config.maxYear,
    allowNegative: false,
  }, isSafeCanonicalInteger);
  // Format afgøres uden årsgrænser: et velformet årstal uden for [minYear, maxYear] committes canonical og
  // bærer et afledt bounds-issue fra en feltvalidator (§1.6). Kun ikke-parsebart format afvises her.
  const formatOnlyConfig: YearDraftParseConfig = { ...config, minYear: undefined, maxYear: undefined };
  return Object.freeze({
    family: 'year',
    parseForSettle: (raw) => {
      const parsed = parseYearDraftForCommit(trimToAlphanumericEdges(raw), formatOnlyConfig);
      return parsed.ok ? validResolution(parsed.value) : rejectedResolution('format');
    },
    format: (value) => value === undefined ? '' : String(value),
    formatForEdit: (value) => value === undefined ? '' : String(value),
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeYearPaste(raw, formatOnlyConfig),
  });
};

export const createWeekFieldCodec = (config: WeekDraftParseConfig): FieldCodec<string | undefined> => {
  assertPositiveInteger('WeekFieldCodec', 'maxDraftLength', config.maxDraftLength);
  assertNumericBounds('WeekFieldCodec', {
    minValue: config.minYear,
    maxValue: config.maxYear,
    allowNegative: false,
  }, isSafeCanonicalInteger);
  // Uge-nummeret (1..52/53) er en repræsenterbarhedsgrænse: en uge uden for det kan ikke være en canonical
  // "UU/ÅÅÅÅ"-værdi og forbliver derfor format-rejected. Årsgrænserne [minYear, maxYear] er derimod bounds:
  // et velformet uge/år-par uden for årsintervallet committes canonical og bærer et afledt bounds-issue (§1.6).
  const formatOnlyConfig: WeekDraftParseConfig = { ...config, minYear: undefined, maxYear: undefined };
  return Object.freeze({
    family: 'week',
    parseForSettle: (raw) => {
      const parsed = parseWeekDraftForCommit(trimToAlphanumericEdges(raw), formatOnlyConfig);
      return parsed.ok ? validResolution(parsed.value) : rejectedResolution('format');
    },
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeWeekPaste(raw, formatOnlyConfig),
  });
};

export const createFractionFieldCodec = (config: FractionParseOptions): FieldCodec<string | undefined> => {
  assertPositiveInteger('FractionFieldCodec', 'maxDigits', config.maxDigits);
  assertOptionalBoolean('FractionFieldCodec', 'allowNegative', config.allowNegative);
  assertOptionalBoolean('FractionFieldCodec', 'allowZeroNumerator', config.allowZeroNumerator);
  assertOptionalBoolean('FractionFieldCodec', 'canonicalizeOnCommit', config.canonicalizeOnCommit);
  assertOptionalBoolean('FractionFieldCodec', 'requireIntegerFraction', config.requireIntegerFraction);
  return Object.freeze({
    family: 'fraction',
    parseForSettle: (raw) => {
      const trimmed = trimToAlphanumericEdges(raw);
      if (trimmed === '') return validResolution(undefined);
      const parsed = parseFractionString(trimmed, config);
      return parsed.ok ? validResolution(parsed.parsed.value) : rejectedResolution('format');
    },
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => /^[0-9/,]$/.test(key) || (key === '-' && config.allowNegative === true),
    normalizePaste: (raw) => normalizeFractionPaste(raw, config),
  });
};

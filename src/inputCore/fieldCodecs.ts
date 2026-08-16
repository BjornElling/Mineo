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
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_RAW_LENGTH,
} from '../utils/amountInputUtils';
import {
  MAX_DATE_DRAFT_LENGTH,
  parseDateDraftForCommit,
  type DateYearPolicy,
  type ParsedDateDraft,
} from '../utils/dateDraftCommit';
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
import {
  parseWeekDraftForCommit,
  type WeekDraftParseConfig,
  type WeekDraftParseResult,
} from '../utils/weekDraftCore';
import { MAX_YEAR_DIGITS, parseYearDraftForCommit, type YearDraftParseConfig } from '../utils/yearDraftCore';
import {
  type FieldCodec,
  type FieldRejectDetail,
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

/**
 * Pakker en parse-kernes KONKRETE fejlbesked som den strukturerede `detail.tooltip`, en `format`-rejection må
 * bære (`error-contract.md` §4: «`format` med `detail.tooltip` → den konkrete codec-leverede tooltip»).
 *
 * **Hvorfor den findes.** Dato-, årstals- og ugekernerne beregnede allerede præcise beskeder
 * («Årstallet skal være mellem 1900 og 2100», «Uge skal være mellem 1 og 53»), men codec'erne SMED dem væk
 * med et bart `rejectedResolution('format')`. Resultatet var, at tre vidt forskellige fejl — et
 * urepræsenterbart årstal, en ikke-eksisterende kalenderdag og ren volapyk — alle nåede brugeren som den
 * samme generiske «Fejl i indtastning». Fordi tabet skete i codec-laget, ramte det ENHVER flade på én gang:
 * formular, gridcelle, a11y-tekst og download-tooltip.
 *
 * Helperen er ét sted, så de tre familier ikke kan drifte fra hinanden, og så en ny familie med en
 * beskedbærende parse-kerne har et færdigt mønster at bruge frem for at genopfinde nøglenavnet.
 */
const tooltipDetail = (tooltip: string): FieldRejectDetail => ({ tooltip });

/**
 * Dato: kun de fejl, hvor der ER noget konkret at fortælle, får en detalje.
 *
 * **Et datofelt taler om DATOER, ikke om årstalsintervaller.** Parse-kernen kan konstatere, at et årstal
 * ligger uden for det repræsenterbare domæne (1900..2100), men den grænse er en egenskab ved
 * `ISODateString` — ikke feltets regel. Ville codec'en selv sige «Årstallet skal være mellem 1900 og 2100»,
 * ville beskeden modsige feltets faktiske grænse: Fødselsdato slutter ved DAGS DATO, ikke ved år 2100.
 * Derfor videregives kun den maskinlæsbare ÅRSAG (`dateInvalidKind`), og selve teksten formuleres af
 * `resolveDateFormatIssueText` ud fra feltets egen `dateBounds`-erklæring — med konkrete datoer.
 * Årstals-ordlyden hører hjemme i årstalsFELTER (`year`-familien), hvor et årstal er selve værdien.
 *
 * `malformed` dækker delvist indtastet og uparsebar tekst («15-», «abc»). Den har bevidst INGEN detalje:
 * den eneste sande besked ville være "dette er ikke en dato", og feltets navn står allerede ved markøren.
 * Den falder derfor i den generiske gren, præcis som `error-contract.md` §4 foreskriver — og som §4 pkt. 1
 * udtrykkeligt nævner for netop en delvist indtastet dato.
 */
const resolveDateTooltipDetail = (
  parsed: Extract<ParsedDateDraft, { ok: false }>
): FieldRejectDetail | undefined =>
  parsed.invalidKind === 'malformed' ? undefined : { dateInvalidKind: parsed.invalidKind };

/**
 * Uge: kun ugenummer-fejlen bærer en konkret tooltip. Se `resolveDateTooltipDetail` om `malformed`.
 * Skellet aflæses på den strukturerede `invalidKind`, ALDRIG på beskedteksten.
 */
const resolveWeekTooltipDetail = (
  parsed: Extract<WeekDraftParseResult, { ok: false }>
): FieldRejectDetail | undefined =>
  parsed.invalidKind === 'weekNumber' ? tooltipDetail(parsed.errorMessage) : undefined;

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

const assertRequiredMaxLength = (codec: string, maxLength: number): void => {
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new Error(`${codec}: maxLength skal være et positivt heltal`);
  }
};

/** Formular- og tabeltekst bruger samme canonical trimning ved settle. Tekst kan aldrig afvises. */
const textFieldCodecBase: Omit<FieldCodec<string>, 'maxLength'> = Object.freeze({
  family: 'text',
  parseForSettle: (raw: string) => validResolution(trimWhitespaceEdges(raw)),
  format: (value: string) => value,
  formatForEdit: (value: string) => value,
  acceptsInitialKey: initialKey(/^.$/u),
});

/**
 * Tekstfelt med feltets erklærede maksimale tegnlængde.
 *
 * **`maxLength` er PÅKRÆVET.** `input-field-behavior-contract.md` §1.2 kræver, at ethvert felt, brugeren
 * skriver i, har en effektiv længdeblokering. Så længe grænsen var valgfri, havde 28 af 31 tekstfelter
 * ingen: «Skadelidte», «Journalnr.», «Særlige kommentarer» og alle bilagsnumre-felter tog imod en
 * vilkårligt lang indsat tekst og gemte den i sagen. Kontrakten var overholdt præcis dér, hvor nogen
 * huskede den — samme fejlmåde som datofelternes manglende grænser (§2.1). Et påkrævet felt i typen er
 * det billigste værn: en ny descriptor uden grænse kan ikke kompilere.
 *
 * Grænsen hører på codecet og ikke på kaldsstedet, fordi BEGGE flader (formularfelt og tabelcelle) skal
 * håndhæve den samme — se `charLengthPolicy.ts`.
 */
export const createTextFieldCodec = (
  options: Readonly<{ maxLength: number; preservesLineBreaks?: boolean }>
): FieldCodec<string> => {
  assertRequiredMaxLength('TextFieldCodec', options.maxLength);
  return Object.freeze({
    ...textFieldCodecBase,
    maxLength: options.maxLength,
    ...(options.preservesLineBreaks === true ? { preservesLineBreaks: true } : {}),
  });
};

/** Optional fritekst: canonical tomhed er `undefined`, ikke `''`. */
const optionalTextFieldCodecBase: Omit<FieldCodec<string | undefined>, 'maxLength'> = Object.freeze({
  family: 'optionalText',
  parseForSettle: (raw: string) => {
    const trimmed = trimWhitespaceEdges(raw);
    return validResolution(trimmed === '' ? undefined : trimmed);
  },
  format: (value: string | undefined) => value ?? '',
  formatForEdit: (value: string | undefined) => value ?? '',
  acceptsInitialKey: initialKey(/^.$/u),
});

/** Se {@link createTextFieldCodec} om hvorfor `maxLength` er påkrævet. */
export const createOptionalTextFieldCodec = (
  options: Readonly<{ maxLength: number; preservesLineBreaks?: boolean }>
): FieldCodec<string | undefined> => {
  assertRequiredMaxLength('OptionalTextFieldCodec', options.maxLength);
  return Object.freeze({
    ...optionalTextFieldCodecBase,
    maxLength: options.maxLength,
    ...(options.preservesLineBreaks === true ? { preservesLineBreaks: true } : {}),
  });
};

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
    options: Object.freeze([...options.values]),
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
    options: Object.freeze([...values]),
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
  options: Object.freeze([false, true]),
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
    // Datoens rå draftlængde er en egenskab ved FORMEN `dd-mm-åååå` og hører derfor på codecet, ikke
    // på hver flade. Den stod før som en importeret konstant både i `DateField` og i `GridDateCell` —
    // og GridYearCell greb ved en fejl netop denne dato-konstant til et ÅRSfelt.
    maxLength: MAX_DATE_DRAFT_LENGTH,
    parseForSettle: (raw): FieldResolution<ISODateString | undefined> => {
      const parsed = parseDateDraftForCommit(raw, options);
      // Kun reelt tom tekst er canonical tomhed; anden ikke-parsebar tekst bevares som rejected format.
      if (parsed.ok && (parsed.iso !== undefined || raw.trim() === '')) return validResolution(parsed.iso);
      // Parse-kernen VED, hvorfor teksten ikke blev en dato. Den viden må ikke kastes væk her: uden den
      // ville et årstal uden for det repræsenterbare domæne (`31-12-1899`) og en ikke-eksisterende
      // kalenderdag (`31-02-2026`) begge blive vist som den generiske «Fejl i indtastning».
      // Se `resolveDateTooltipDetail` for hvorfor `malformed` bevidst IKKE får en konkret tooltip.
      return rejectedResolution('format', parsed.ok ? undefined : resolveDateTooltipDetail(parsed));
    },
    format: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
    formatForEdit: (value) => value === undefined ? '' : coerceToDanishDateString(value) ?? '',
    acceptsInitialKey: initialKey(/^\d$/),
    normalizePaste: (raw) => normalizeDatePaste(raw),
  });

/**
 * Heltalsfelt.
 *
 * **`maxDigits` er PÅKRÆVET** — samme begrundelse som {@link createTextFieldCodec}. Da grænsen var
 * valgfri, havde 8 af 12 heltalsfelter ingen: «Méngrad» (maksimum 120) og «Tilkendt for periode»
 * (maksimum 10) tog imod 30 cifre og blev først røde bagefter. Cifferloftet er en LÆNGDEregel og
 * blødgør ikke feltets talværdigrænse: en værdi inden for cifferantallet, men uden for `minValue`/
 * `maxValue`, committes fortsat canonical med rød ring og konkret tooltip (§1.2/§1.6).
 */
export const createIntegerFieldCodec = (
  config: Omit<IntegerDraftParseConfig, 'maxDigits'>
    & Readonly<{ maxDigits: number; minValue?: number; maxValue?: number }>
): FieldCodec<number | undefined> => {
  assertBoolean('IntegerFieldCodec', 'allowNegative', config.allowNegative);
  assertPositiveInteger('IntegerFieldCodec', 'maxDigits', config.maxDigits);
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
      // Cifferloftet gælder den skrivende overflade, ikke allerede indlæst eller programmatisk input (§1.2).
      // Derfor parses en sikker heltalsværdi her uden at gøre feltets input-admission til en schema-afvisning.
      const parsed = parseIntegerDraftForCommit(normalized, { allowNegative: true });
      if (!parsed.ok) return rejectedResolution('format');
      return validResolution(parsed.value);
    },
    format: (value) => value === undefined ? '' : String(value),
    formatForEdit: (value) => value === undefined ? '' : String(value),
    maxDigits: config.maxDigits,
    // Minus åbner kun editoren på et felt, der FÅR være negativt.
    acceptsInitialKey: (key) => /^\d$/.test(key) || (key === '-' && config.allowNegative),
    normalizePaste: (raw) => normalizeIntegerPaste(raw, {
      allowNegative: config.allowNegative,
      maxDigits: config.maxDigits,
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
    decimalPolicy: options.allowDecimals ? 'decimal' : 'integerOnly',
    parseForSettle: (raw): FieldResolution<AmountValue | undefined> => {
      const parsed = parseAmountInput(raw, {
        precision: displayPrecision,
        // Fortegn er en canonical bounds-regel; parseren afviser kun format og sikker repræsentation.
        allowNegative: true,
        allowDecimals: options.allowDecimals,
        maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
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
    // Et ikke-negativt felt må stadig bruge minus som SUBTRAKTION i et åbent udtryk ("5000-200"),
    // men et tomt felt skal ikke åbnes med et ugyldigt unært minus. Det åbne draft-filter afgør fortsat
    // den samme skelnen gennem `containsUnaryMinusToken`.
    acceptsInitialKey: (key) => {
      if (key === '-') return options.allowNegative;
      return (options.allowDecimals ? /^[0-9,()]$/ : /^[0-9()]$/).test(key);
    },
    normalizePaste: (raw) => normalizeAmountPaste(raw, {
      allowNegative: options.allowNegative,
      allowDecimals: options.allowDecimals,
      maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
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
      allowNegative: config.allowNegative,
      allowDecimals: config.allowDecimals,
      maxIntegerDigits: 3,
      maxDecimalDigits: config.allowDecimals ? 2 : 0,
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
  ...(sourceCodec.maxDigits === undefined ? {} : { maxDigits: sourceCodec.maxDigits }),
  // Længdeloftet arves på samme måde som fortegn og cifre: adapteren ændrer kun canonical TOMHED til
  // `''`, ikke hvor lang en draft feltet tager imod. Uden viderestillingen mistede ugecellerne — alle
  // fire er string-backede — deres erklærede loft.
  ...(sourceCodec.maxLength === undefined ? {} : { maxLength: sourceCodec.maxLength }),
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
    // Årets form ER fire cifre. Tallet stod før hardkodet både i `YearField` (4) og i `GridYearCell`,
    // hvor det ved en fejl var dato-konstanten (16). Én erklæring, begge flader læser.
    maxDigits: MAX_YEAR_DIGITS,
    parseForSettle: (raw) => {
      const parsed = parseYearDraftForCommit(trimToAlphanumericEdges(raw), formatOnlyConfig);
      // Årsgrænserne er fjernet fra `formatOnlyConfig` (bounds er en validators ansvar, §1.6), så den eneste
      // fejl, kernen kan melde her, er «Ugyldigt årstal» — en besked, der ikke siger mere end feltets navn.
      // Den falder derfor bevidst i den generiske gren frem for at blive en støjende tooltip.
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
    // Den rå draftlængde er allerede erklæret i konfigurationen; `WeekField` hardkodede sin egen kopi
    // (8), og grid-cellen havde slet ingen. Én erklæring, begge flader læser.
    maxLength: config.maxDraftLength,
    parseForSettle: (raw) => {
      const parsed = parseWeekDraftForCommit(trimToAlphanumericEdges(raw), formatOnlyConfig);
      if (parsed.ok) return validResolution(parsed.value);
      // UGE-nummeret er en repræsenterbarhedsgrænse (se ovenfor) og forbliver derfor `format` — men
      // «Uge skal være mellem 1 og 53» fortæller præcis, hvad rettelsen er, og er dermed netop den slags
      // besked, `detail.tooltip` findes til. De rent formmæssige beskeder («Ugyldigt format»,
      // «Ugyldigt årstal») siger derimod ikke mere end feltets navn og forbliver generiske.
      return rejectedResolution('format', resolveWeekTooltipDetail(parsed));
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
    // Fortegnspolitikken er DATA på samme måde som for de øvrige numeriske familier. Uden den ville
    // `codecAllowsNegative` fail-open til `true` for brøker, som kontrakten netop forbyder fortegn i
    // (§2.4) — og `FractionField`s hardkodede `false` ville være den eneste kilde igen.
    signPolicy: config.allowNegative === true ? 'signed' : 'nonNegative',
    // Ciffergrænsen er DATA på codecet, ikke en konstant i `FractionField`: kaldsstedet erklærede den
    // allerede her, mens komponenten hardkodede sin egen kopi af samme tal — præcis den drift, som
    // `charLengthPolicy.ts` blev oprettet for at fjerne for beløb og procent.
    maxDigits: config.maxDigits,
    parseForSettle: (raw) => {
      // Brøken må parses strengt: alfanumerisk kanttrimning ville fx gøre `,5/2` eller `-1/2`
      // til en anden, gyldig værdi i stedet for at bevare den faktiske fejlende tekst.
      const trimmed = raw.trim();
      if (trimmed === '') return validResolution(undefined);
      const parsed = parseFractionString(trimmed, config);
      if (parsed.ok) return validResolution(parsed.parsed.value);
      const detail = parsed.reason === 'zero-denominator'
        ? { tooltip: 'Nævneren må ikke være 0' }
        : parsed.reason === 'zero-numerator'
          ? { tooltip: 'Tælleren må ikke være 0' }
          : undefined;
      return rejectedResolution('format', detail);
    },
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => /^[0-9/,]$/.test(key) || (key === '-' && config.allowNegative === true),
    normalizePaste: (raw) => normalizeFractionPaste(raw, config),
  });
};

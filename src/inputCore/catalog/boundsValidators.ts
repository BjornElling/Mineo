import { getIntegerRangeErrorMessage } from '../../utils/integerRange';
import { getYearRangeErrorMessage } from '../../utils/yearDraftCore';
import { buildPercentRangeErrorMessage } from '../../utils/percentDraftCore';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { FieldValidator } from '../fieldDescriptor';
import { resolveFieldLabel } from '../fieldDescriptor';
import type { FieldCodec } from '../fieldCodec';
import { quoteFieldLabel } from '../inputIssue';

// §1.6: en schema-repræsenterbar værdi uden for feltets aktive min/max er IKKE rejected råtekst – den
// committes canonical og bærer et afledt `bounds`-issue fra en feltvalidator. Disse helpers lægger
// min/max-vurderingen i den canonical feltvalidator og genbruger de fælles message-buildere, så den røde
// beskedtekst er den samme overalt.

const boundsDetail = (
  min: number | undefined,
  max: number | undefined
): Readonly<Record<string, number>> => {
  const detail: Record<string, number> = {};
  if (min !== undefined) detail.minValue = min;
  if (max !== undefined) detail.maxValue = max;
  return detail;
};

/**
 * En årsgrænse er enten et fast tal eller en funktion, der læser grænsen på
 * valideringstidspunktet.
 *
 * Thunk-formen findes for de grænser der afhænger af DAGS DATO (typisk `getCurrentYear`).
 * Blev sådan en grænse indfanget som et tal, når descriptor-kataloget bygges ved modulets
 * import, ville en session der står åben over midnat – eller over et årsskifte – validere
 * mod det GAMLE år, og brugeren kunne ikke indtaste det aktuelle årstal uden at genindlæse.
 * Statiske grænser (fx `MIN_YEAR`) skal fortsat sendes som tal.
 */
export type YearBound = number | (() => number) | undefined;

const resolveYearBound = (bound: YearBound): number | undefined =>
  typeof bound === 'function' ? bound() : bound;

const parseStrictIntegerString = (value: string): number | undefined => {
  if (!/^-?\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parseStrictYearString = (value: string): number | undefined => {
  if (!/^\d{4}$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

/**
 * Defense-in-depth for string-backed legacy-schemafelter. Tolerant `.eo`-load kan levere en schema-gyldig streng,
 * som feltets codec ikke kan fortolke (fx "abc" som måned). Parsebare historiske former accepteres; kun en reel
 * codec-afvisning bliver et canonical schema-issue.
 */
export const canonicalStringCodecValidator = (
  code: string,
  codec: FieldCodec<string | undefined>
): FieldValidator<string | undefined> => (value, field, view) => {
  if (value === undefined || value.trim() === '') return undefined;
  if (codec.parseForSettle(value).status === 'valid') return undefined;
  return {
    reason: 'schema',
    code,
    // Samme navneautoritet som `format`-beskeden: en kontekstuel label (§2.2) skal også her være det navn,
    // brugeren ser stå ved feltet.
    message: `Der er gemt en ugyldig værdi i feltet ${quoteFieldLabel(resolveFieldLabel(field.descriptor, view))}`,
  };
};

/**
 * Canonical bounds-validator for et heltalsfelt (besked via `getIntegerRangeErrorMessage`).
 *
 * `unit` navngiver hvad tallet TÆLLER. «Værdi skal være mellem 1 og 10» siger ikke, at der er tale
 * om år; kun feltet ved det, så enheden leveres af descriptoren.
 */
export const integerBoundsValidator = (
  code: string,
  minValue: number | undefined,
  maxValue: number | undefined,
  unit?: string
): FieldValidator<number | undefined> => (value) => {
  if (value === undefined) return undefined;
  const message = getIntegerRangeErrorMessage(value, minValue, maxValue, unit === undefined ? {} : { unit });
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(minValue, maxValue) };
};

/** Canonical bounds-validator for et heltal, der historisk persisteres som streng. */
export const integerStringBoundsValidator = (
  code: string,
  minValue: number | undefined,
  maxValue: number | undefined
): FieldValidator<string | undefined> => (value) => {
  if (value === undefined || value.trim() === '') return undefined;
  const numeric = parseStrictIntegerString(value);
  if (numeric === undefined) return undefined;
  const message = getIntegerRangeErrorMessage(numeric, minValue, maxValue);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(minValue, maxValue) };
};

/** Canonical bounds-validator for et procentfelt (besked via `buildPercentRangeErrorMessage`). */
export const percentBoundsValidator = (
  code: string,
  bounds: Readonly<{
    minValue?: number;
    maxValue?: number;
    allowDecimals: boolean;
    /** Brugerrettet, domænespecifik intervaltekst når standarden »Procent« er for upræcis. */
    message?: string;
  }>
): FieldValidator<number | undefined> => (value) => {
  if (value === undefined) return undefined;
  const defaultMessage = buildPercentRangeErrorMessage(value, bounds);
  if (defaultMessage === null) return undefined;
  const message = bounds.message ?? defaultMessage;
  return { reason: 'bounds', code, message, detail: boundsDetail(bounds.minValue, bounds.maxValue) };
};

/**
 * Erklæring af en EKSKLUSIV nedre grænse på et beløbsfelt: `minValue` selv er ikke tilladt.
 *
 * `subject` er sætningens subjekt i den udledte besked («Månedslønnen skal være større end 0 kr.»);
 * udeladt = «Beløbet».
 */
export type AmountExclusiveMin = Readonly<{ minExclusive: true; subject?: string }>;

/**
 * Canonical bounds-validator for et beløbsfelt (direkte min/max-sammenligning).
 *
 * **Eksklusiv nedre grænse.** Et felt, hvor 0 kr. ikke er et svar, erklærer det HER med
 * `exclusiveMin` – ikke som en separat «> 0»-regel ved siden af en inklusiv grænse på 0. Med to
 * erklæringer rammer et negativt resultat (`100-200` → -100) begge, og §1.8's prioritet (bounds før rule)
 * lader den inklusive besked «Værdi skal være 0 kr. eller højere» vinde – en påstand om, at 0 er tilladt, i
 * et felt, hvor 0 netop afvises. Én erklæring giver én udledt besked, der er sand for både 0 og negativt.
 */
export const amountBoundsValidator = (
  code: string,
  minValue: number | undefined,
  maxValue: number | undefined,
  exclusiveMin?: AmountExclusiveMin
): FieldValidator<AmountValue | undefined> => (value) => {
  const numeric = value?.value;
  if (numeric === undefined) return undefined;
  const minExclusive = exclusiveMin?.minExclusive === true;
  // Et negativt beløb bryder også en eksklusiv grænse, selv i et felt, hvis codec tillader minus (de
  // manuelle grundlønninger): «større end 0» er den grænse, brugeren skal ramme.
  const satisfiesMin = minValue === undefined || (minExclusive ? numeric > minValue : numeric >= minValue);
  if (satisfiesMin && (maxValue === undefined || numeric <= maxValue)) {
    return undefined;
  }
  return {
    reason: 'bounds',
    code,
    // Et beløbsfelts grænser er kroner; enheden står i beskeden af samme grund som tusindseparatoren
    // «mellem 1000 og 551000» kan ikke læses i en fart og siger ikke, hvad tallet er.
    message: getIntegerRangeErrorMessage(numeric, minValue, maxValue, {
      unit: 'kr.',
      ...(minExclusive ? { minExclusive: true, subject: exclusiveMin?.subject ?? 'Beløbet' } : {}),
    }),
    detail: boundsDetail(minValue, maxValue),
  };
};

/**
 * Et beløbsfelt, hvor 0 kr. ikke er et svar: nedre grænse 0, EKSKLUSIV. Den ene erklæring for alle de
 * felter – brug den i stedet for en inklusiv grænse på 0 (se {@link amountBoundsValidator}).
 */
export const positiveAmountBoundsValidator = (
  code: string,
  subject?: string
): FieldValidator<AmountValue | undefined> =>
  amountBoundsValidator(code, 0, undefined, subject === undefined
    ? { minExclusive: true }
    : { minExclusive: true, subject });

/** Canonical bounds-validator for et årstalsfelt (besked via `getYearRangeErrorMessage`). */
export const yearBoundsValidator = (
  code: string,
  minYear: YearBound,
  maxYear: YearBound
): FieldValidator<number | undefined> => (value) => {
  if (value === undefined) return undefined;
  const min = resolveYearBound(minYear);
  const max = resolveYearBound(maxYear);
  const message = getYearRangeErrorMessage(value, min, max);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(min, max) };
};

/**
 * Canonical bounds-validator for et string-backed årstalsfelt (tabellens "År"-kolonne): den canonical værdi er
 * årets streng. Årstal uden for [minYear, maxYear] er canonical og bærer et `bounds`-issue.
 */
export const yearStringBoundsValidator = (
  code: string,
  minYear: YearBound,
  maxYear: YearBound
): FieldValidator<string | undefined> => (value) => {
  if (value === undefined || value.trim() === '') return undefined;
  const year = parseStrictYearString(value);
  if (year === undefined) return undefined;
  const min = resolveYearBound(minYear);
  const max = resolveYearBound(maxYear);
  const message = getYearRangeErrorMessage(year, min, max);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(min, max) };
};

/**
 * Canonical bounds-validator for et string-backed ugefelt ("UU/ÅÅÅÅ"): kun ÅRSDELEN er en bounds-grænse. Selve
 * uge-nummeret (1..52/53) er en repræsenterbarhedsgrænse, der forbliver format-rejected i codecet.
 */
export const weekYearBoundsValidator = (
  code: string,
  minYear: YearBound,
  maxYear: YearBound
): FieldValidator<string | undefined> => (value) => {
  if (value === undefined || value.trim() === '') return undefined;
  const yearPart = value.split('/')[1];
  if (yearPart === undefined) return undefined;
  const year = parseStrictYearString(yearPart);
  if (year === undefined) return undefined;
  const min = resolveYearBound(minYear);
  const max = resolveYearBound(maxYear);
  const message = getYearRangeErrorMessage(year, min, max);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(min, max) };
};

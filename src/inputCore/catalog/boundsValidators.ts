import { getIntegerRangeErrorMessage } from '../../utils/integerRange';
import { getYearRangeErrorMessage } from '../../utils/yearDraftCore';
import { buildPercentRangeErrorMessage } from '../../utils/percentDraftCore';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { FieldValidator } from '../fieldDescriptor';
import type { FieldCodec } from '../fieldCodec';
import { quoteFieldLabel } from '../inputIssue';

// Kravændringen 2026-07-18 (§1.6): en schema-repræsenterbar værdi uden for feltets aktive min/max er IKKE
// længere rejected råtekst — den committes canonical og bærer et afledt `bounds`-issue fra en feltvalidator.
// Tidligere afviste codecet værdien som `range`; disse helpers flytter min/max-vurderingen til den canonical
// feltvalidator OG genbruger de eksisterende message-buildere, så den røde beskedtekst er byte-uændret.

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
 * Defense-in-depth for string-backed legacy-schemafelter. Tolerant `.eo`-load kan levere en schema-gyldig streng,
 * som feltets codec ikke kan fortolke (fx "abc" som måned). Parsebare historiske former accepteres; kun en reel
 * codec-afvisning bliver et canonical schema-issue.
 */
export const canonicalStringCodecValidator = (
  code: string,
  codec: FieldCodec<string | undefined>
): FieldValidator<string | undefined> => (value, field) => {
  if (value === undefined || value.trim() === '') return undefined;
  if (codec.parseForSettle(value).status === 'valid') return undefined;
  return {
    reason: 'schema',
    code,
    message: `Der er gemt en ugyldig værdi i feltet ${quoteFieldLabel(field.descriptor.label)}`,
  };
};

/** Canonical bounds-validator for et heltalsfelt (tidligere codec-`range` via `getIntegerRangeErrorMessage`). */
export const integerBoundsValidator = (
  code: string,
  minValue: number | undefined,
  maxValue: number | undefined
): FieldValidator<number | undefined> => (value) => {
  if (value === undefined) return undefined;
  const message = getIntegerRangeErrorMessage(value, minValue, maxValue);
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
  const numeric = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(numeric)) return undefined;
  const message = getIntegerRangeErrorMessage(numeric, minValue, maxValue);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(minValue, maxValue) };
};

/** Canonical bounds-validator for et procentfelt (tidligere codec-`range` via `buildPercentRangeErrorMessage`). */
export const percentBoundsValidator = (
  code: string,
  bounds: Readonly<{ minValue?: number; maxValue?: number; allowDecimals: boolean }>
): FieldValidator<number | undefined> => (value) => {
  if (value === undefined) return undefined;
  const message = buildPercentRangeErrorMessage(value, bounds);
  if (message === null) return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(bounds.minValue, bounds.maxValue) };
};

/** Canonical bounds-validator for et beløbsfelt (tidligere codec-`range` via direkte min/max-sammenligning). */
export const amountBoundsValidator = (
  code: string,
  minValue: number | undefined,
  maxValue: number | undefined
): FieldValidator<AmountValue | undefined> => (value) => {
  const numeric = value?.value;
  if (numeric === undefined) return undefined;
  if ((minValue === undefined || numeric >= minValue) && (maxValue === undefined || numeric <= maxValue)) {
    return undefined;
  }
  return {
    reason: 'bounds',
    code,
    message: getIntegerRangeErrorMessage(numeric, minValue, maxValue),
    detail: boundsDetail(minValue, maxValue),
  };
};

/** Canonical bounds-validator for et årstalsfelt (tidligere codec-`range` via `getYearRangeErrorMessage`). */
export const yearBoundsValidator = (
  code: string,
  minYear: number | undefined,
  maxYear: number | undefined
): FieldValidator<number | undefined> => (value) => {
  if (value === undefined) return undefined;
  const message = getYearRangeErrorMessage(value, minYear, maxYear);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(minYear, maxYear) };
};

/**
 * Canonical bounds-validator for et string-backed årstalsfelt (tabellens "År"-kolonne): den canonical værdi er
 * årets streng. Tidligere afviste codec-`range` årstal uden for [minYear, maxYear]; nu er de canonical.
 */
export const yearStringBoundsValidator = (
  code: string,
  minYear: number | undefined,
  maxYear: number | undefined
): FieldValidator<string | undefined> => (value) => {
  if (value === undefined || value.trim() === '') return undefined;
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) return undefined;
  const message = getYearRangeErrorMessage(year, minYear, maxYear);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(minYear, maxYear) };
};

/**
 * Canonical bounds-validator for et string-backed ugefelt ("UU/ÅÅÅÅ"): kun ÅRSDELEN er en bounds-grænse. Selve
 * uge-nummeret (1..52/53) er en repræsenterbarhedsgrænse, der forbliver format-rejected i codecet.
 */
export const weekYearBoundsValidator = (
  code: string,
  minYear: number | undefined,
  maxYear: number | undefined
): FieldValidator<string | undefined> => (value) => {
  if (value === undefined || value.trim() === '') return undefined;
  const yearPart = value.split('/')[1];
  if (yearPart === undefined) return undefined;
  const year = Number.parseInt(yearPart, 10);
  if (!Number.isFinite(year)) return undefined;
  const message = getYearRangeErrorMessage(year, minYear, maxYear);
  if (message === '') return undefined;
  return { reason: 'bounds', code, message, detail: boundsDetail(minYear, maxYear) };
};

import type { FieldErrorBySource, FieldErrorSource } from '../../types/fieldErrors';
import { DEFAULT_FIELD_ERROR_SOURCE_PRIORITY } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import type { DebugStatus } from './eoDebugTypes';

export const isNonEmptyString = (value: string | undefined): value is string => {
  if (value === undefined) return false;
  return value.trim() !== '';
};

export const collectPresentFieldErrors = (
  bySource: FieldErrorBySource | undefined,
  sourcePriority: readonly FieldErrorSource[] = DEFAULT_FIELD_ERROR_SOURCE_PRIORITY
): ReadonlyArray<NonNullable<FieldErrorBySource[FieldErrorSource]>> => {
  const resolvedErrors = bySource ?? {};
  return sourcePriority
    .map((source) => resolvedErrors[source])
    .filter((e): e is NonNullable<typeof e> => Boolean(e && e.message.trim() !== ''));
};

export const summarizeFieldErrorsForDebug = (
  errors: FieldErrorBySource | undefined
): { displayValue: string; status: DebugStatus } | null => {
  const present = collectPresentFieldErrors(errors);
  if (present.length === 0) return null;

  const hasError = present.some((e) => e.severity === 'error');
  const status: DebugStatus = hasError ? 'error' : 'warning';
  const prefix = status === 'error' ? 'Fejl' : 'Advarsel';
  const parts = present.map((e) => e.message.trim()).filter((m) => m !== '');
  return { displayValue: `${prefix} (${parts.join('; ')})`, status };
};

export const resolveDebugDisplay = (args: {
  value: string | undefined;
  errors: FieldErrorBySource | undefined;
  emptyState: DebugStatus;
}): { displayValue: string; status: DebugStatus } => {
  const errorSummary = summarizeFieldErrorsForDebug(args.errors);
  if (errorSummary) return errorSummary;

  if (isNonEmptyString(args.value)) {
    return { displayValue: args.value.trim(), status: 'ok' };
  }

  return { displayValue: '-', status: args.emptyState };
};

export const formatISODateForTooltip = (value: ISODateString): string => {
  return isoToDanish(value) ?? value;
};

export const buildNoValidDateRangeMessage = (args: {
  minDate: ISODateString;
  maxDate: ISODateString;
  noValidRangeCause?: string | undefined;
}): string => {
  const minText = formatISODateForTooltip(args.minDate);
  const maxText = formatISODateForTooltip(args.maxDate);
  const causeSuffix =
    typeof args.noValidRangeCause === 'string' && args.noValidRangeCause.trim() !== ''
      ? ` Værdien afgrænses af: ${args.noValidRangeCause.trim()}`
      : ' Kontrollér de felter der bestemmer datointervallet.';
  return `Ingen gyldige datoer: min-dato (${minText}) er efter max-dato (${maxText}).${causeSuffix}`;
};

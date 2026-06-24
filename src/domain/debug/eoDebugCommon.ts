import type { FieldErrorBySource, FieldErrorSource } from '../../types/fieldErrors';
import { DEFAULT_FIELD_ERROR_SOURCE_PRIORITY } from '../../types/fieldErrors';
import type { DebugStatus } from './eoDebugTypes';

// Neutrale validerings-tekst-/streng-helpers bor nu i domænets validerings-lag, så de kan
// deles med det autoritative blokerings-modul (B9). Re-eksporteres her, så eksisterende
// debug-importer er uændrede.
export {
  isNonEmptyString,
  formatISODateForTooltip,
  buildNoValidDateRangeMessage,
} from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';

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

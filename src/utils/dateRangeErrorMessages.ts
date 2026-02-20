import { isoToDanish } from '../types/branded';
import type { ISODateString } from '../types/branded';
import { TODAY } from '../config/dateRanges';
import { validateISODateRange } from './isoDateHelpers';

export type DateRangeSpecialErrors = {
  /**
   * Used for paired "Fra-dato" / "Til-dato" inputs where the max/min is derived from the other field.
   */
  fraTilRole?: 'fra' | 'til';
  /**
   * Used when the effective `minDate` is derived from Skadesdato/Anmeldedato rules.
   */
  minBoundKind?: 'skadesdato' | 'anmeldedatoMinus5Aar';
  /**
   * The user-visible reference date that produced the bound (typically Skadesdato/Anmeldedato).
   * This is used for special messages that must mention the concrete reference date.
   */
  minBoundReferenceISO?: ISODateString;
};

const formatISOForTooltip = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

export const resolveDateRangeErrorMessage = (args: {
  iso: ISODateString;
  minDate: ISODateString | undefined;
  maxDate: ISODateString | undefined;
  special?: DateRangeSpecialErrors;
}): string => {
  const { iso, minDate, maxDate, special } = args;

  // Bound-kind messages must take precedence over paired Fra/Til messages to avoid misleading output.
  // Example: when the effective min is "Skadesdato", the correct message is about Skadesdato, not "Til < Fra".
  if (maxDate && maxDate === TODAY && iso > maxDate) {
    return `Datoen er efter dags dato (${formatISOForTooltip(maxDate)})`;
  }

  if (special?.minBoundKind === 'skadesdato' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    return `Datoen kan ikke være før skadesdagen (${formatISOForTooltip(reference)})`;
  }

  if (special?.minBoundKind === 'anmeldedatoMinus5Aar' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    return `Datoen er mere end 5 år før anmeldedatoen (${formatISOForTooltip(reference)})`;
  }

  if (special?.fraTilRole === 'fra' && maxDate && iso > maxDate) {
    return 'Fra-dato er større end til-dato';
  }
  if (special?.fraTilRole === 'til' && minDate && iso < minDate) {
    return 'Til-dato er mindre end fra-dato';
  }

  return validateISODateRange(iso, minDate, maxDate).errorMessage;
};

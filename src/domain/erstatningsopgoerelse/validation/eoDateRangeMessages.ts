import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';

/** Fælles ordlyd for perioderegler og EO-rækkeevaluering. */
export const isNonEmptyString = (value: string | undefined): value is string => {
  if (value === undefined) return false;
  return value.trim() !== '';
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

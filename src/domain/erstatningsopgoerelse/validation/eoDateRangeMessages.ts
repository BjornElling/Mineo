import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';

/**
 * Neutrale dato-/streng-validerings-helpers (uden afhængighed af debug-laget), så både
 * det autoritative blokerings-modul (`eoBlockingValidation`, jf. B9) og debug-visningen
 * kan dele præcis samme besked-konstruktion — ÉN sandhedskilde for ordlyden.
 *
 * Flyttet ud af `domain/debug/eoDebugCommon.ts`: domæne-validering må ikke importere fra
 * `domain/debug/` (isolations-invariant A), og disse helpers er ren validerings-tekst.
 */

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

import type { ISODateString } from '../../types/branded';
import { aarsloenAslMax, getYearBoundsForYearlyRate } from '../../data/lovbestemteRates';
import { formatAsAmount } from '../../utils/formatUtils';

export const validateAslAarsloenDivisibleBy1000 = (
  aarsloen: number | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (aarsloen % 1000 !== 0) return 'Årsløn skal være deleligt med 1.000.';
  return undefined;
};

export const validateAslAarsloenBySkadesaarMax = (
  aarsloen: number | undefined,
  skadedatoIso: ISODateString | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (skadedatoIso === undefined) return undefined;

  const skadesaar = Number.parseInt(skadedatoIso.slice(0, 4), 10);
  if (!Number.isFinite(skadesaar)) return undefined;

  const maxAarsloen = aarsloenAslMax[skadesaar];
  if (maxAarsloen === undefined || !Number.isFinite(maxAarsloen)) {
    // Fail-closed: en manglende maks-sats for skadesåret må ikke stiltiende acceptere årslønnen.
    // Det rammer fx en skade i et år uden offentliggjort sats (før 2005 eller et fremtidigt år).
    const bounds = getYearBoundsForYearlyRate(aarsloenAslMax);
    const boundsText = bounds ? ` (satser findes kun for ${bounds.minYear}–${bounds.maxYear})` : '';
    return `Maks-årsløn for skadesåret ${skadesaar} kunne ikke slås op${boundsText}.`;
  }
  if (aarsloen <= maxAarsloen) return undefined;

  return `Årsløn kan ikke overstige maks årslønnen i skadesåret (${formatAsAmount(maxAarsloen, 0)} kr.)`;
};

import type { ISODateString } from '../../types/branded';
import {
  formatAslAarsloensmaksimumMissing,
  resolveAslAarsloensmaksimumForAar,
} from '../satser/aslAarsloensmaksimum';
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

  const maxAarsloen = resolveAslAarsloensmaksimumForAar(skadesaar);
  if (maxAarsloen === undefined) {
    // Fail-closed: en manglende maks-sats for skadesåret må ikke stiltiende acceptere årslønnen.
    // Det rammer fx en skade i et år uden offentliggjort sats (før 2005 eller et fremtidigt år).
    // Kanonisk ordlyd via gateway'en — samme besked som de øvrige faner.
    return formatAslAarsloensmaksimumMissing(skadesaar);
  }
  if (aarsloen <= maxAarsloen) return undefined;

  return `Årsløn kan ikke overstige maks årslønnen i skadesåret (${formatAsAmount(maxAarsloen, 0)} kr.)`;
};

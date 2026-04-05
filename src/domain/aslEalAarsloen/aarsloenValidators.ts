import type { ISODateString } from '../../types/branded';
import { aarsloenAslMax } from '../../data/lovbestemteRates';
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
  if (!Number.isFinite(maxAarsloen)) return undefined;
  if (aarsloen <= maxAarsloen) return undefined;

  return `Årsløn kan ikke overstige maks årslønnen i skadesåret (${formatAsAmount(maxAarsloen, 0)} kr.)`;
};

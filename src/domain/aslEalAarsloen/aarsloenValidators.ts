import type { ISODateString } from '../../types/branded';
import { aarsloenMax } from '../../data/regulationRates';
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
  skadesdatoIso: ISODateString | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (skadesdatoIso === undefined) return undefined;

  const skadesaar = Number.parseInt(skadesdatoIso.slice(0, 4), 10);
  if (!Number.isFinite(skadesaar)) return undefined;

  const maxAarsloen = aarsloenMax[skadesaar];
  if (!Number.isFinite(maxAarsloen)) return undefined;
  if (aarsloen <= maxAarsloen) return undefined;

  return `Årsløn kan ikke overstige maks årslønnen i skadesåret (${formatAsAmount(maxAarsloen, 0)} kr.)`;
};

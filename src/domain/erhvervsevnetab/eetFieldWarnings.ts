import { createFieldWarning, type FieldWarning } from '../../inputCore/fieldWarning';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { ISODateString } from '../../types/branded';
import { isoYear } from '../../utils/isoDateHelpers';
import { aarsloenAslMax, type YearlyRate } from '../../data/lovbestemteRates';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';

/** Kanonisk, ikke-blokerende feltadvarsel for EET-procenter under lovens minimum. */
export const EET_UNDER_15_WARNING = 'Der kan ikke tilkendes erhvervsevnetab under 15 %';

export const resolveEetUnder15Warning = (value: number | undefined): FieldWarning | undefined =>
  value !== undefined && value > 0 && value < 15 ? createFieldWarning(EET_UNDER_15_WARNING) : undefined;

/** Kort feltbesked når ASL-årslønnen står på skadesårets maksimum. */
export const EET_ASL_AARSLOEN_MAX_WARNING = 'Årsløn efter ASL er sat til max-årslønnen';

/**
 * Samme trigger som beregningens `warn-asl-aarsloen-is-max`, samlet så feltvisningen og beregningen ikke kan drifte.
 * EAL-feltet skal være tomt, fordi en allerede indtastet EAL-årsløn er det eksplicitte valg, advarslen skal opfordre
 * brugeren til at træffe.
 */
export const hasEetAslAarsloenMaxWarning = (
  aslAarsloen: AmountValue | undefined,
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
  aslAarsloenMax: YearlyRate = aarsloenAslMax,
): boolean => {
  const aslAarsloenValue = amountValueToNumber(aslAarsloen);
  const ealAarsloenValue = amountValueToNumber(ealAarsloen);
  if (ealAarsloenValue !== undefined || aslAarsloenValue === undefined || skadedato === undefined) {
    return false;
  }

  const maxAarsloen = resolveAslAarsloensmaksimumForAar(isoYear(skadedato), aslAarsloenMax);
  return maxAarsloen !== undefined && aslAarsloenValue === maxAarsloen;
};

export const resolveEetAslAarsloenMaxWarning = (
  aslAarsloen: AmountValue | undefined,
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
): FieldWarning | undefined =>
  hasEetAslAarsloenMaxWarning(aslAarsloen, ealAarsloen, skadedato)
    ? createFieldWarning(EET_ASL_AARSLOEN_MAX_WARNING)
    : undefined;

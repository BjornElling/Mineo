import { createFieldWarning, type FieldWarning } from '../../inputCore/fieldWarning';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { ISODateString } from '../../types/branded';
import { isoYear } from '../../utils/isoDateHelpers';
import { aarsloenAslMax, type YearlyRate } from '../../data/lovbestemteRates';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import { ASL_AARSLOEN_MAX_NOTICE } from '../aslEalAarsloen/aslAarsloenMaxNotice';

/** Kanonisk, ikke-blokerende feltadvarsel for EET-procenter under lovens minimum. */
export const EET_UNDER_15_WARNING = 'Der kan ikke tilkendes erhvervsevnetab under 15 %';

export const resolveEetUnder15Warning = (value: number | undefined): FieldWarning | undefined =>
  value !== undefined && value > 0 && value < 15 ? createFieldWarning(EET_UNDER_15_WARNING) : undefined;

/**
 * Feltbeskeden når ASL-årslønnen står på skadesårets maksimum.
 *
 * Teksten ejes af det DELTE årslønsfelt, ikke af denne flade (BB-124): Forsørgertab havde sin egen,
 * handlingsanvisende formulering for præcis samme situation, og de to nåede hver sin halvdel af brugerne.
 * Skriv ikke en flade-lokal variant igen – ret den fælles konstant.
 */
export const EET_ASL_AARSLOEN_MAX_WARNING = ASL_AARSLOEN_MAX_NOTICE;

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

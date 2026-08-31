import { createFieldWarning, type FieldWarning } from '../../inputCore/fieldWarning';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { ISODateString } from '../../types/branded';
import { isoYear } from '../../utils/isoDateHelpers';
import { aarsloenAslMax, type YearlyRate } from '../../data/lovbestemteRates';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import { ASL_AARSLOEN_MAX_NOTICE } from '../aslEalAarsloen/aslAarsloenMaxNotice';

type KapitaliseringsPctRow = Readonly<{ rowId: string; kapitaliseringspct: number }>;

/** Kanonisk, ikke-blokerende feltadvarsel for EET-procenter under lovens minimum. */
export const EET_UNDER_15_WARNING = 'Der kan ikke tilkendes erhvervsevnetab under 15 %';

export const resolveEetUnder15Warning = (value: number | undefined): FieldWarning | undefined =>
  value !== undefined && value > 0 && value < 15 ? createFieldWarning(EET_UNDER_15_WARNING) : undefined;

/** Kanonisk advarsel for en selvstændig kapitalisering under den lovbestemte tærskel. */
export const KAPITALISERING_UNDER_15_WARNING = 'Der er angivet kapitalisering med mindre end 15 %';

/**
 * Returnerer de kapitaliseringsrækker, der skal fremhæves.
 *
 * En forhøjelse fra fx 20 % til 30 % kan lovligt kapitalisere de yderligere 10 %. Derfor gælder
 * advarslen alene den første kapitalisering og den samlede kapitalisering – aldrig en senere
 * delkapitalisering isoleret. Rækkerne kommer fra kapitaliseringsmotorens færdige rækkefølge, så
 * feltadvarslen og resultatfanen vurderer nøjagtigt den samme kapitalisering.
 */
export const kapitaliseringUnder15WarningRowIds = (
  rows: readonly KapitaliseringsPctRow[]
): ReadonlySet<string> => {
  const first = rows[0];
  if (first === undefined) return new Set();
  const total = rows.reduce((sum, row) => sum + row.kapitaliseringspct, 0);
  if (first.kapitaliseringspct >= 15 && total >= 15) return new Set();
  // Summen under 15 indebærer altid også en første kapitalisering under 15, fordi alle kapitaliseringer
  // er positive. Begge betingelser står med vilje eksplicit, så den juridiske regel ikke forsvinder i en
  // senere refaktorering af rækkernes repræsentation.
  return new Set([first.rowId]);
};

export const resolveKapitaliseringUnder15Warning = (
  rowId: string,
  rows: readonly KapitaliseringsPctRow[]
): FieldWarning | undefined => kapitaliseringUnder15WarningRowIds(rows).has(rowId)
  ? createFieldWarning(KAPITALISERING_UNDER_15_WARNING)
  : undefined;

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

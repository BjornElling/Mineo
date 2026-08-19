import { formatKr } from '../utils/formatUtils';
import type { AmountValue } from '../schemas/amountExpressionSchema';
import type { FieldIssueSpec } from './fieldDescriptor';

/**
 * Feltets øvre/nedre grænse for et beløb, BRUGEREN kan frembringe: `±9.999.999,99`
 * (`input-field-behavior-contract.md` §2.2). Afledt af de 7 heltalscifre + 2 decimaler frem for skrevet
 * i hånden, så de to tal ikke kan komme fra hinanden.
 */
export const MAX_AMOUNT_INPUT_VALUE = 9_999_999.99;
export const MIN_AMOUNT_INPUT_VALUE = -9_999_999.99;

/**
 * Canonical rød feltfejl for et beløb, hvis VÆRDI ligger uden for `±9.999.999,99`.
 *
 * **Hvorfor den findes ved siden af ciffergrænsen.** Ciffergrænsen er en længderegel og blokerer det
 * 8. heltalsciffer tegn for tegn. Den kan ikke fange et gyldigt UDTRYK, der regner sig forbi grænsen:
 * i `9999999*2` er intet talled for langt, men resultatet er 19.999.998. §2.2 og §8 foreskriver netop
 * derfor, at et sådant resultat bevares canonical med rød ring og konkret tooltip og blokerer de
 * beregninger og dokumenter, hvor beløbet indgår – det kan ikke blokeres ved indtastningen.
 *
 * `reason` er `bounds`, fordi `resolveFieldIssueTooltip` viser `bounds`-beskeder ORDRET; den generiske
 * «Fejl i indtastning» ville skjule netop den grænse, der gør fejlen forståelig
 * (jf. `project_field_tooltip_vs_error_box`).
 *
 * Validatoren tilføjes DERIVERET til hvert felt med codec-familien `amount` i `defineField`, så et nyt
 * beløbsfelt ikke kan opstå uden den. Feltets egne, skarpere min/max-validators står før i listen og
 * har forrang (§1.8), så et felt med maksimum 100.000 fortsat viser sin egen strengere besked.
 */
export const amountResultBoundsValidator = (code: string) =>
  (value: AmountValue | undefined): FieldIssueSpec | undefined => {
    const numeric = value?.value;
    if (numeric === undefined || !Number.isFinite(numeric)) return undefined;
    if (numeric > MAX_AMOUNT_INPUT_VALUE) {
      return {
        reason: 'bounds',
        code,
        message: `Beløbet kan ikke overstige ${formatKr(MAX_AMOUNT_INPUT_VALUE, 2)}`,
        detail: { maxValue: MAX_AMOUNT_INPUT_VALUE },
      };
    }
    if (numeric < MIN_AMOUNT_INPUT_VALUE) {
      return {
        reason: 'bounds',
        code,
        message: `Beløbet kan ikke være mindre end ${formatKr(MIN_AMOUNT_INPUT_VALUE, 2)}`,
        detail: { minValue: MIN_AMOUNT_INPUT_VALUE },
      };
    }
    return undefined;
  };

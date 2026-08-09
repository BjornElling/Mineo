import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from '../../../utils/amountInputUtils';
import {
  DEFAULT_PERCENT_DECIMAL_PRECISION,
  DEFAULT_PERCENT_TYPING_MAX_INTEGER_DIGITS,
} from '../../../utils/percentInputUtils';
import type { FieldRef } from '../../fieldDescriptor';
import { fieldAllowsNegative } from './signPolicy';
import { fieldAllowsDecimals } from './decimalPolicy';

/**
 * Feltets tegn- og længdepolitik, udledt af descriptorens codec — ÉT sted, begge flader læser.
 *
 * **Hvorfor dette modul findes.** Ciffergrænsen skal håndhæves ens i formularfeltet og i tabelcellen,
 * men de to flader konfigurerede hver sit tegnfilter i hånden på hvert kaldssted. Resultatet var målt
 * uenighed om samme felt-familie: `GridAmountCell` sendte `maxDecimalDigits`, `AmountField` gjorde
 * ikke — så den 3. decimal kunne tastes i en formular, men ikke i en celle. `maxDraftLength` var
 * spejlbilledet: `AmountField` sendte 512, og INGEN grid-celle sendte noget.
 *
 * Politikken hører derfor her, hvor begge flader henter den samme værdi, i stedet for at blive gentaget.
 * Det er præcis samme begrundelse, som lagde `signPolicy` og `decimalPolicy` på codecet
 * (`fieldCodec.ts`): kan to flader konfigurere den samme regel hver for sig, ender de med at gøre det
 * forskelligt.
 *
 * Grænserne er LOFTER, ikke tilladelser (`input-field-behavior-contract.md` §2.2/§8): et felt med
 * færre cifre, et lavere maksimum, forbud mod negative beløb eller krav om delelighed beholder sin
 * strengere regel, som håndhæves af feltets egne validatorer på den canonical værdi.
 */

/** Samlede filterindstillinger for et beløbsfelt (formular OG grid). */
export const resolveAmountCharPolicy = <T>(field: FieldRef<T>): Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  maxIntegerDigits: number;
  maxDecimalDigits: number;
  maxDraftLength: number;
}> => {
  const allowDecimals = fieldAllowsDecimals(field);
  return Object.freeze({
    allowNegative: fieldAllowsNegative(field),
    allowDecimals,
    maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
    // Et felt uden decimaler har grænsen 0 — ikke «ingen grænse». Ellers ville et heltalsfelt
    // acceptere en decimalhale, som codec'en hverken viser eller kan rumme.
    maxDecimalDigits: allowDecimals ? DEFAULT_AMOUNT_PRECISION : 0,
    maxDraftLength: MAX_AMOUNT_RAW_LENGTH,
  });
};

/** Samlede filterindstillinger for et procentfelt (formular OG grid). */
export const resolvePercentCharPolicy = <T>(field: FieldRef<T>): Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  maxIntegerDigits: number;
  maxDecimalDigits: number;
  maxDraftLength: number;
}> => {
  const allowDecimals = fieldAllowsDecimals(field);
  const maxDecimalDigits = allowDecimals ? DEFAULT_PERCENT_DECIMAL_PRECISION : 0;
  const allowNegative = fieldAllowsNegative(field);
  return Object.freeze({
    allowNegative,
    allowDecimals,
    maxIntegerDigits: DEFAULT_PERCENT_TYPING_MAX_INTEGER_DIGITS,
    maxDecimalDigits,
    // Rå draft-loft: cifrene + et eventuelt komma + et eventuelt fortegn. Udledt frem for hardkodet,
    // så et felt uden decimaler ikke får plads til en hale, det ikke kan bruge.
    maxDraftLength: DEFAULT_PERCENT_TYPING_MAX_INTEGER_DIGITS
      + (maxDecimalDigits > 0 ? maxDecimalDigits + 1 : 0)
      + (allowNegative ? 1 : 0),
  });
};

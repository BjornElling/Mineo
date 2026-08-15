import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from '../../../utils/amountInputUtils';
import {
  DEFAULT_PERCENT_DECIMAL_PRECISION,
  DEFAULT_PERCENT_TYPING_MAX_INTEGER_DIGITS,
} from '../../../utils/percentInputUtils';
import type { FieldCodecFamily } from '../../fieldCodec';
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

/**
 * Codecets erklærede rå draft-loft. Kaster, hvis familien mangler sin erklæring.
 *
 * Fail-closed er bevidst og er selve pointen: en familie, hvis længde ER en egenskab ved formen (dato,
 * uge) eller ved feltet (tekst), skal erklære den på codecet. Faldt vi i stedet tavst tilbage til «ingen
 * grænse», ville et nyt felt uden erklæring se ud til at virke — og det var præcis den tilstand, 28
 * tekstfelter og 8 heltalsfelter befandt sig i.
 */
const requireCodecMaxLength = <T>(field: FieldRef<T>): number => {
  const declared = field.descriptor.codec.maxLength;
  if (declared === undefined) {
    throw new Error(
      `Feltet «${field.descriptor.id}» (${field.descriptor.codec.family}) mangler en erklæret maxLength `
      + 'på sit codec. Tegn- og længdeværnet er ikke valgfrit (input-field-behavior-contract.md §1.2).'
    );
  }
  return declared;
};

/** Som {@link requireCodecMaxLength}, men for de familier, der erklærer et CIFFER-loft. */
const requireCodecMaxDigits = <T>(field: FieldRef<T>): number => {
  const declared = field.descriptor.codec.maxDigits;
  if (declared === undefined) {
    throw new Error(
      `Feltet «${field.descriptor.id}» (${field.descriptor.codec.family}) mangler et erklæret maxDigits `
      + 'på sit codec. Tegn- og længdeværnet er ikke valgfrit (input-field-behavior-contract.md §1.2).'
    );
  }
  return declared;
};

/** Heltalsfelt (formular OG grid): cifferloft fra codecet, plads til et lovligt fortegn i råteksten. */
export const resolveIntegerCharPolicy = <T>(field: FieldRef<T>): Readonly<{
  allowNegative: boolean;
  maxDigits: number;
  maxDraftLength: number;
}> => {
  const allowNegative = fieldAllowsNegative(field);
  const maxDigits = requireCodecMaxDigits(field);
  return Object.freeze({
    allowNegative,
    maxDigits,
    maxDraftLength: maxDigits + (allowNegative ? 1 : 0),
  });
};

/** År-felt (formular OG grid): fire cifre, erklæret af codecet. */
export const resolveYearCharPolicy = <T>(field: FieldRef<T>): Readonly<{
  maxDigits: number;
  maxDraftLength: number;
}> => {
  const maxDigits = requireCodecMaxDigits(field);
  return Object.freeze({ maxDigits, maxDraftLength: maxDigits });
};

/** Uge- og datofelt (formular OG grid): rå draftlængde erklæret af codecet, fordi den følger formen. */
export const resolveFormLengthPolicy = <T>(field: FieldRef<T>): Readonly<{ maxDraftLength: number }> =>
  Object.freeze({ maxDraftLength: requireCodecMaxLength(field) });

/** Fritekstfelt (formular OG grid): feltets erklærede maksimale tegnlængde. */
export const resolveTextCharPolicy = <T>(field: FieldRef<T>): Readonly<{ maxLength: number }> =>
  Object.freeze({ maxLength: requireCodecMaxLength(field) });

/**
 * Brøkfelt: cifferloft pr. del fra codecet.
 *
 * Det rå loft rummer to dele à `maxDigits` heltalscifre + komma + `maxDigits` decimaler samt skråstregen.
 * `FractionField` hardkodede før både cifferloftet og manglede loftet helt — begge dele stammer nu fra
 * den ENE erklæring på codecet.
 */
export const resolveFractionCharPolicy = <T>(field: FieldRef<T>): Readonly<{
  allowNegative: boolean;
  maxDigits: number;
  maxDraftLength: number;
}> => {
  const maxDigits = requireCodecMaxDigits(field);
  const allowNegative = fieldAllowsNegative(field);
  const partLength = maxDigits + 1 + maxDigits;
  return Object.freeze({
    allowNegative,
    maxDigits,
    maxDraftLength: partLength * 2 + 1 + (allowNegative ? 1 : 0),
  });
};

/**
 * De familier, hvor brugeren TASTER en draft, og som derfor skal have et rå længdeloft (§1.2).
 *
 * Valg-, toggle- og radiofamilierne står bevidst udenfor: de committer et valg, ikke en tekst, så et
 * tegnloft er meningsløst for dem. `stringBacked` er en adapter og videresender det indre codecs
 * erklæring.
 */
const TYPED_DRAFT_FAMILIES = Object.freeze([
  'text', 'optionalText', 'date', 'integer', 'amount', 'percent', 'year', 'week', 'fraction', 'stringBacked',
] as const);

export const isTypedDraftFamily = (family: FieldCodecFamily): boolean =>
  (TYPED_DRAFT_FAMILIES as readonly string[]).includes(family);

/**
 * Feltets rå draft-loft, som de to flader faktisk håndhæver det — ÉN indgang for alle familier.
 *
 * Findes for at gøre kravet MÅLBART på tværs af hele produktionskataloget: uden en fælles indgang kunne
 * et harness kun kontrollere de familier, nogen huskede at nævne. Kaster for et felt i en tastet familie
 * uden erklæring, hvilket er selve værnet — se `requireCodecMaxLength`.
 */
export const resolveDraftLengthLimit = <T>(field: FieldRef<T>): number | undefined => {
  const family = field.descriptor.codec.family;
  switch (family) {
    case 'text':
    case 'optionalText':
      return resolveTextCharPolicy(field).maxLength;
    case 'date':
    case 'week':
      return resolveFormLengthPolicy(field).maxDraftLength;
    case 'integer':
      return resolveIntegerCharPolicy(field).maxDraftLength;
    case 'year':
      return resolveYearCharPolicy(field).maxDraftLength;
    case 'fraction':
      return resolveFractionCharPolicy(field).maxDraftLength;
    case 'amount':
      return resolveAmountCharPolicy(field).maxDraftLength;
    case 'percent':
      return resolvePercentCharPolicy(field).maxDraftLength;
    case 'stringBacked':
      // Adapteren bærer det indre codecs erklæring videre; hvilken celle der renderer den (uge, år
      // eller heltal) afgøres af kolonnen, ikke af descriptoren. Her returneres derfor den RÅ
      // erklæring — det er dens tilstedeværelse, værnet måler.
      return field.descriptor.codec.maxLength ?? field.descriptor.codec.maxDigits;
    default:
      return undefined;
  }
};

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

import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { DEFAULT_FRACTION_MAX_DIGITS, parseFractionString } from '../../../utils/fraction';
import { formatPercent } from '../../../utils/formatUtils';

export type ForligsgradResolved = Readonly<{
  factor: number;
  label: string;
}>;

export type Forligsgrad = ForligsgradResolved | null;

export type ForligAnsvarsgradInput = Pick<
  ErstatningsopgoerelseValues,
  'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek'
>;

/**
 * Rig evaluering af forlig om ansvarsgrad — skelner bevidst mellem "intet forlig" (empty),
 * "gyldigt forlig" (valid) og "ugyldigt forlig" (invalid). Bruges på differencekrav-fanen, hvor
 * et ugyldigt forlig skal blokere beregningen, mens `parseForligsgrad` (uændret) blot returnerer
 * `null` i begge ikke-gyldige tilfælde til de eksisterende EO-forbrugere.
 */
export type ForligsgradEvaluation =
  | Readonly<{ status: 'empty'; forlig: null }>
  | Readonly<{ status: 'valid'; forlig: ForligsgradResolved }>
  | Readonly<{ status: 'invalid'; forlig: null; reason: 'both' | 'broek'; message: string }>;

const parseForligBroek = (broekTrimmed: string) =>
  parseFractionString(broekTrimmed, {
    maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
    allowNegative: false,
    allowZeroNumerator: false,
    canonicalizeOnCommit: false,
  });

export const evaluateForligsgrad = (values: ForligAnsvarsgradInput): ForligsgradEvaluation => {
  const procentValue = values.forligAnsvarsgradProcent;
  // Spejler EO-validatorens "begge udfyldt"-regel: en sat procent (inkl. 0) sammen med en brøk er
  // tvetydigt og dermed ugyldigt.
  const hasProcent = procentValue !== undefined && procentValue !== null;
  const broekValue = values.forligAnsvarsgradBroek;
  const broekTrimmed = typeof broekValue === 'string' ? broekValue.trim() : '';
  const hasBroek = broekTrimmed !== '';

  if (hasProcent && hasBroek) {
    return { status: 'invalid', forlig: null, reason: 'both', message: 'Angiv enten procent eller brøk – ikke begge' };
  }

  if (typeof procentValue === 'number' && Number.isFinite(procentValue) && procentValue > 0 && procentValue <= 100) {
    return {
      status: 'valid',
      // Kanonisk dansk procentformat (komma-decimal + mellemrum): 12,5 → "12,5 %", 50 → "50 %".
      forlig: { factor: procentValue / 100, label: formatPercent(procentValue) },
    };
  }

  if (hasBroek) {
    const result = parseForligBroek(broekTrimmed);
    if (result.ok && result.parsed.numerator <= result.parsed.denominator) {
      return { status: 'valid', forlig: { factor: result.parsed.factor, label: result.parsed.value } };
    }
    return { status: 'invalid', forlig: null, reason: 'broek', message: 'Brøk skal angives som fx "1/3" og kan ikke overstige 1' };
  }

  // En procent uden for det gyldige interval (fx 0) uden brøk betragtes som "intet forlig" — ingen
  // reduktion. Spejler at EO-validatoren ikke flagger procent=0 som fejl.
  return { status: 'empty', forlig: null };
};

/**
 * Kanonisk prosa-sætning om at der er indgået forlig — delt mellem erstatningsopgørelse-PDF'en og
 * differencekrav-PDF/docx/UI, så formuleringen kun findes ét sted.
 *
 * `datoLang` er den allerede formaterede dato (lang form, uden "den"-præfiks) eller `null`, når der
 * ikke er angivet en forligsdato. Funktionen er bevidst ren (formaterer ikke selv datoer).
 */
export const buildForligIndgaaetSaetning = (label: string, datoLang: string | null): string =>
  datoLang
    ? `Der er den ${datoLang} indgået forlig i sagen på betaling af ${label}.`
    : `Der er indgået forlig i sagen på betaling af ${label}.`;

export const parseForligsgrad = (
  values: ForligAnsvarsgradInput
): Forligsgrad => {
  const procentValue = values.forligAnsvarsgradProcent;
  if (typeof procentValue === 'number' && Number.isFinite(procentValue) && procentValue > 0 && procentValue <= 100) {
    return {
      factor: procentValue / 100,
      // Kanonisk dansk procentformat (komma-decimal + mellemrum): 12,5 → "12,5 %", 50 → "50 %".
      label: formatPercent(procentValue),
    };
  }

  const broekValue = values.forligAnsvarsgradBroek;
  if (typeof broekValue === 'string' && broekValue.trim() !== '') {
    const result = parseFractionString(broekValue, {
      maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
      allowNegative: false,
      allowZeroNumerator: false,
      canonicalizeOnCommit: false,
    });
    if (result.ok && result.parsed.numerator <= result.parsed.denominator) {
      return {
        factor: result.parsed.factor,
        label: result.parsed.value,
      };
    }
  }

  return null;
};

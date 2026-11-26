import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { DEFAULT_FRACTION_MAX_DIGITS, parseFractionString } from '../../../utils/fraction';
import { formatPercent } from '../../../utils/formatUtils';

/**
 * Rækkens brugervendte navn – ét sted, fordi de tre forligsfelter vises på tre flader
 * (Erstatningsopgørelsens «EO-oplysninger», Erhvervsevnetabs «EET oplysninger» og
 * beregningsoversigten) og navngives i «Fejl og advarsler» på fire.
 */
export const FORLIG_ANSVARSGRAD_LABEL = 'Forlig om ansvarsgrad';

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
 * Rig evaluering af forlig om ansvarsgrad – skelner bevidst mellem "intet forlig" (empty),
 * "gyldigt forlig" (valid) og "ugyldigt forlig" (invalid). Bruges på differencekrav-fanen, hvor
 * et ugyldigt forlig skal blokere beregningen, mens `parseForligsgrad` (uændret) blot returnerer
 * `null` i begge ikke-gyldige tilfælde til de eksisterende EO-forbrugere.
 */
export type ForligsgradEvaluation =
  | Readonly<{ status: 'empty'; forlig: null }>
  | Readonly<{ status: 'valid'; forlig: ForligsgradResolved }>
  | Readonly<{ status: 'invalid'; forlig: null; reason: 'both' | 'broek' | 'broekUnderMinimum'; message: string }>;

/**
 * En brøk under 1/100 er udtryk for en fejl, ligesom en procent under 1: de to felter er to
 * måder at taste samme ansvarsgrad og skal derfor have samme nedre grænse. Teksten følger procentfeltets
 * «Procent skal være mellem 1 og 100».
 */
export const FORLIG_BROEK_UNDER_MINIMUM_FEJL = 'Brøk skal svare til mindst 1 %';

/**
 * Om brøken er under 1 %. Sammenligningen holdes på tæller og nævner (`tæller · 100 < nævner`), så en
 * brøk præcis på grænsen (1/100, 2/200) ikke afhænger af kommatalsafrunding i den udregnede faktor.
 */
const erBroekUnderEnProcent = (parsed: Readonly<{ numerator: number; denominator: number }>): boolean =>
  parsed.numerator * 100 < parsed.denominator;

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
      if (erBroekUnderEnProcent(result.parsed)) {
        return { status: 'invalid', forlig: null, reason: 'broekUnderMinimum', message: FORLIG_BROEK_UNDER_MINIMUM_FEJL };
      }
      return { status: 'valid', forlig: { factor: result.parsed.factor, label: result.parsed.value } };
    }
    return { status: 'invalid', forlig: null, reason: 'broek', message: 'Brøk skal angives som fx "1/3" og kan ikke overstige 1' };
  }

  // En procent uden for det gyldige interval (fx 0) uden brøk betragtes her som "intet forlig" – ingen
  // reduktion. Feltet selv er rødt under 1 % (`eo.forligAnsvarsgradProcent.bounds`), så værdien spærrer
  // download og når aldrig et dokument; motoren skal blot ikke regne med en faktor på 0 imens.
  return { status: 'empty', forlig: null };
};

/**
 * Kanonisk prosa-sætning om at der er indgået forlig – delt mellem erstatningsopgørelse-PDF'en og
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

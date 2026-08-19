import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from './amountInputUtils';
import { DEFAULT_FRACTION_MAX_DIGITS, isFractionDraftAllowed } from './fraction';
import {
  isAmountExpressionDraftAllowed,
  isPercentDraftAllowed,
  isWeekDraftAllowed,
  isYearDraftAllowed,
  MAX_YEAR_DRAFT_DIGITS as MAX_YEAR_PASTE_DIGITS,
} from './numericDraftAdmission';
import { type TwoDigitYearPolicy } from './yearDraftCore';

// `findNextDigitIndex`, `extractContiguousDigits` og `isWithinBounds` er fjernet 2026-08-18. De tjente
// UDELUKKENDE års- og uge-normaliseringernes egne fortolkere: «find den første ciffergruppe, og forkort
// den til den passer grænserne». Den fremgangsmåde er ophævet ved brugerbeslutning (§1.2a punkt 5: en
// grænse må aldrig forkorte en indsat tekst — grænser er bounds og hører i feltvalidatoren), og
// hjælperne er ikke efterladt: de er byggeklodserne til præcis den regel, der ikke må opstå igen.
//
// Bemærk hvad der IKKE er ophævet: `normalizeDatePaste` nedenfor fortolker fortsat en hel indsat tekst
// og er bevaret med vilje (§1.2a punkt 7, brugerens afgørelse af BB-003: indsættelse må gerne være mere
// tolerant end tastning). Kravet er, at samme paste giver samme resultat uanset feltets tilstand — ikke
// at paste er identisk med tastning. Det, der var forkert i års- og ugefortolkerne, var grænse-
// afkortningen og tilstandsafhængigheden, ikke fortolkningen af hele teksten.

type NumericPasteOptions = Readonly<{
  allowNegative?: boolean;
  allowDecimals?: boolean;
  maxIntegerDigits?: number;
  maxDecimalDigits?: number;
  minValue?: number;
  maxValue?: number;
}>;

type AmountPasteOptions = NumericPasteOptions & Readonly<{
  maxRawLength?: number;
}>;

const normalizePositiveIntegerOption = (value: number | undefined, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
};

const normalizeNonNegativeIntegerOption = (value: number | undefined, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : fallback;
};

/**
 * Normaliserer clipboard-tekst for fritekstfelter uden at trimme den.
 *
 * Paste skal ikke kunne gemme browserens forskellige whitespace-tegn eller CR-linjeslutninger i sagen.
 * Trimning hører fortsat til det fælles settle, så en åben draft ikke ændrer brugerens ydre mellemrum.
 */
export const normalizeClipboardText = (
  raw: string,
  options: Readonly<{ preservesLineBreaks?: boolean }> = {}
): string => {
  const lineEndingsNormalized = raw.replace(/\r\n?/gu, '\n');
  const whitespaceNormalized = lineEndingsNormalized
    .replace(/[\u00a0\u202f\u2007\u2000-\u200a\t]/gu, ' ')
    .replace(/[\u200b\ufeff\u00ad]/gu, '');
  const lineBreaksNormalized = options.preservesLineBreaks === true
    ? whitespaceNormalized
    : whitespaceNormalized.replace(/\n/gu, ' ');
  return lineBreaksNormalized.replace(/ {2,}/gu, ' ');
};

/**
 * Behandler den indsatte tekst som på hinanden følgende tastetryk fra et tomt felt.
 * Tegn, der ikke passer feltets aktuelle tekst, springes over, mens resten fortsætter.
 */
const filterPasteCharacters = (
  text: string,
  isDraftAllowed: (draft: string) => boolean,
  maxLength?: number
): string => {
  let result = '';
  for (const character of text) {
    const candidate = `${result}${character}`;
    if ((maxLength === undefined || candidate.length <= maxLength) && isDraftAllowed(candidate)) {
      result = candidate;
    }
  }
  return result;
};

/**
 * Filtrerer dato-paste efter cifferlængde og tegnfølge — aldrig efter kalender-værdi.
 *
 * Et ciffer, der overskrider dag/måned/år-segmentets længde, springes over, men afbryder ikke resten af
 * pasten. Det er vigtigt, at fx `32-12-2020` når frem til settle som netop den ugyldige dato, så en
 * kalenderfejl ikke tavst reduceres til `3`. Separatorer før første tal ignoreres, og gentagne separatorer
 * kollapses ved at springe alle efter den første over (§1.2a og §2.1).
 */
export const normalizeDatePaste = (text: string): string => {
  const segmentMaxLengths = [2, 2, 4] as const;
  const digitGroups = text.match(/[0-9]+/g) ?? [];
  let segmentIndex = 0;
  let result = '';

  for (const [groupIndex, group] of digitGroups.entries()) {
    if (segmentIndex >= segmentMaxLengths.length) break;

    // Den første sammenhængende ciffergruppe kan være en separatorfri dato (`17121956`) og fylder
    // derfor flere komponenter. Efterfølgende grupper er allerede adskilt af mindst ét ugyldigt tegn;
    // de hører kun til den næste komponent. Det springer både gentagne separatorer og overskydende
    // cifre over uden at afbryde resten af paste-handlingen (`12-345-2020` → `12-34-2020`).
    const available = segmentMaxLengths[segmentIndex];
    const accepted = groupIndex === 0
      ? group.slice(0, segmentMaxLengths.slice(segmentIndex).reduce((sum, max) => sum + max, 0))
      : group.slice(0, available);
    let offset = 0;
    while (offset < accepted.length && segmentIndex < segmentMaxLengths.length) {
      const segment = accepted.slice(offset, offset + segmentMaxLengths[segmentIndex]);
      if (segment !== '') {
        if (result !== '') result += '-';
        result += segment;
        offset += segment.length;
        segmentIndex += 1;
      }
    }

  }

  return result;
};

export const normalizeIntegerPaste = (
  text: string,
  options: Readonly<{
    maxDigits?: number;
    minValue?: number;
    maxValue?: number;
    allowNegative?: boolean;
  }> = {}
): string => {
  const allowNegative = options.allowNegative === true;
  const maxDigits = options.maxDigits;
  return filterPasteCharacters(text, (draft) => {
    const unsigned = draft.startsWith('-') ? draft.slice(1) : draft;
    return (allowNegative ? /^-?\d*$/ : /^\d*$/).test(draft)
      && (maxDigits === undefined || unsigned.length <= maxDigits);
  });
};

export const normalizeAmountPaste = (
  text: string,
  options: AmountPasteOptions = {}
): string => {
  const allowDecimals = options.allowDecimals !== false;
  const maxIntegerDigits = normalizePositiveIntegerOption(
    options.maxIntegerDigits,
    MAX_AMOUNT_INPUT_INTEGER_DIGITS
  );
  const maxDecimalDigits = normalizeNonNegativeIntegerOption(
    options.maxDecimalDigits,
    DEFAULT_AMOUNT_PRECISION
  );
  const maxRawLength = normalizePositiveIntegerOption(options.maxRawLength, MAX_AMOUNT_RAW_LENGTH);
  return filterPasteCharacters(
    text,
    (draft) => isAmountExpressionDraftAllowed(draft, {
      allowNegative: options.allowNegative,
      allowDecimals,
      maxIntegerDigits,
      maxDecimalDigits,
    }),
    maxRawLength
  );
};

export const normalizePercentPaste = (
  text: string,
  options: NumericPasteOptions = {}
): string => {
  const allowDecimals = options.allowDecimals === true;
  const maxIntegerDigits = normalizePositiveIntegerOption(options.maxIntegerDigits, 3);
  const maxDecimalDigits = normalizeNonNegativeIntegerOption(options.maxDecimalDigits, 2);
  return filterPasteCharacters(text, (draft) => isPercentDraftAllowed(draft, {
    allowNegative: options.allowNegative,
    allowDecimals,
    maxIntegerDigits,
    maxDecimalDigits,
  }));
};

export const normalizeFractionPaste = (
  text: string,
  options: Readonly<{
    maxDigits?: number;
    allowNegative?: boolean;
    requireIntegerFraction?: boolean;
  }> = {}
): string => {
  const maxDigits = normalizePositiveIntegerOption(options.maxDigits, DEFAULT_FRACTION_MAX_DIGITS);
  return filterPasteCharacters(text, (draft) =>
    (options.requireIntegerFraction !== true || !draft.includes(','))
    && isFractionDraftAllowed(draft, { maxDigits, allowNegative: options.allowNegative })
  );
};

/**
 * Uge-paste (§1.2a): tegn for tegn gennem ugefeltets EGET tegnprædikat.
 *
 * Funktionen byggede før uge- og årssegmentet hver for sig og limede dem sammen med `/`, og den kaldte
 * samtidig årsfeltets tilsvarende fortolker (se {@link normalizeYearPaste}). Begge er fjernet ved
 * brugerbeslutning 2026-08-18, fordi de forkortede en indsat tekst for at få den inden for
 * årsgrænserne — og fordi de kun blev kaldt i et tomt felt, så samme paste gav to udfald.
 *
 * Ugefamilien har derfor bevidst INGEN egen fortolkning tilbage. Det er ikke et generelt forbud mod at
 * fortolke en hel indsat tekst — datofamilien gør det fortsat (§1.2a punkt 7) — men her er der intet
 * uomtvisteligt at udlede: `17-12` kan lige så godt være uge 17 i 2012 som en dato, og settle løser det
 * bedre end paste kan.
 *
 * Sammensætningen tabes ikke ved det. `weekAdmission` accepterer selv `-`, `.`, `,`, `/`, `\` og
 * mellemrum som separator, og `parseWeekDraftForCommit` normaliserer separatoren til `/` og nulstiller
 * ugenummeret ved settle. `17-12` bliver derfor stadig `17/12` — men nu ad præcis samme vej som
 * tastning, i settle frem for i paste.
 */
export const normalizeWeekPaste = (
  text: string,
  options: Readonly<{
    minYear?: number;
    maxYear?: number;
    twoDigitYearPolicy?: TwoDigitYearPolicy;
    maxDraftLength?: number;
  }> = {}
): string => filterPasteCharacters(text, isWeekDraftAllowed, options.maxDraftLength);

/**
 * Års-paste (§1.2a): tegn for tegn gennem årsfeltets tegnprædikat — højst fire cifre.
 *
 * **Fjernet ved brugerbeslutning 2026-08-18.** Funktionen udtrak før den første sammenhængende
 * ciffergruppe og forkortede den derefter, indtil resultatet lå inden for feltets årsgrænser. Det gav
 * to fejl, som brugerfundet BB-031 målte:
 *
 * 1. **Samme paste gav to forskellige værdier.** Normaliseringen kaldes kun, når draften er tom
 *    (`normalizePasteForDraft`); et udfyldt felt fik den almindelige tegn-for-tegn-regel i stedet.
 *    `2.026` blev derfor `2` → 2002 i et tomt felt, men `2026` i et udfyldt.
 * 2. **En værdi uden for grænserne blev tavst en anden, gyldig værdi.** `2035` med maksimum 2030 blev
 *    forkortet til `20` → 2020. Det er præcis det, §1.2a punkt 5 forbyder: et filtreret resultat, der
 *    stadig er ugyldigt, skal bevares som fejltekst — ikke ændres til noget gyldigt.
 *
 * Årsgrænserne hører derfor slet ikke til her. De er bounds og ejes af feltvalidatoren (§1.6), som
 * giver rød ring og konkret tooltip på en canonical værdi. `options` beholdes i signaturen, fordi
 * kalderne sender feltets fulde codec-konfiguration; ingen af felterne bruges længere til filtrering.
 */
export const normalizeYearPaste = (
  text: string,
  _options: Readonly<{
    minYear?: number;
    maxYear?: number;
    twoDigitYearPolicy?: TwoDigitYearPolicy;
  }> = {}
): string => filterPasteCharacters(text, isYearDraftAllowed, MAX_YEAR_PASTE_DIGITS);

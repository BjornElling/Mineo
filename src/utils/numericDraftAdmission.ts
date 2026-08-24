/**
 * Rene tegn- og længdeværn for numeriske drafts. Tastaturfiltrene og paste-normaliseringen
 * læser samme prædikater, så en indsættelse ikke kan få et tegn ind, som en tastning ville afvise.
 */

export type AmountDraftConstraints = Readonly<{
  allowNegative?: boolean;
  allowDecimals?: boolean;
  maxDecimalDigits?: number;
  maxIntegerDigits?: number;
}>;

export type PercentDraftConstraints = Readonly<{
  allowNegative?: boolean;
  allowDecimals?: boolean;
  maxDecimalDigits?: number;
  maxIntegerDigits?: number;
}>;

export const containsUnaryMinusToken = (input: string): boolean => {
  const compact = input.replace(/\s+/g, '');
  return /(^|[+\-*/x(])-/.test(compact);
};

const exceedsAmountTokenDigits = (
  draft: string,
  maxIntegerDigits: number,
  maxDecimalDigits: number | undefined
): boolean => {
  // Operatorer og parenteser afgrænser et talled. Et evt. tomt talled opstår under
  // redigering og har ingen cifre at afvise.
  for (const token of draft.split(/[+\-*/x()\s]+/)) {
    if (token === '') continue;
    const [integerPart = '', ...decimalParts] = token.split(',');
    if (integerPart.replace(/\D/g, '').length > maxIntegerDigits) return true;
    if (
      typeof maxDecimalDigits === 'number'
      && decimalParts.join('').replace(/\D/g, '').length > maxDecimalDigits
    ) {
      return true;
    }
  }
  return false;
};

/** Et beløbsudtryk må have ét decimalkomma pr. talled, aldrig flere i samme tal. */
const hasMultipleDecimalSeparatorsInAmountToken = (draft: string): boolean =>
  draft.split(/[+\-*/x()\s]+/).some((token) => (token.match(/,/g)?.length ?? 0) > 1);

/** Om hele den kommende beløbsdraft kan rumme præcis de tegn, brugeren har skrevet. */
export const isAmountExpressionDraftAllowed = (
  draft: string,
  options: AmountDraftConstraints = {}
): boolean => {
  const allowNegative = options.allowNegative === true;
  const allowDecimals = options.allowDecimals !== false;
  const maxDecimalDigits = options.maxDecimalDigits;

  if (!allowNegative && containsUnaryMinusToken(draft)) return false;
  if (draft.includes('.') || hasMultipleDecimalSeparatorsInAmountToken(draft)) return false;
  if (
    allowDecimals
    && typeof maxDecimalDigits === 'number'
    && Number.isInteger(maxDecimalDigits)
    && maxDecimalDigits >= 0
    && new RegExp(`,\\d{${maxDecimalDigits + 1}}`).test(draft)
  ) {
    return false;
  }
  if (
    typeof options.maxIntegerDigits === 'number'
    && exceedsAmountTokenDigits(
      draft,
      options.maxIntegerDigits,
      allowDecimals ? maxDecimalDigits : 0
    )
  ) {
    return false;
  }

  const allowed = allowDecimals
    ? /^[0-9+\-*/x(),]*$/
    : /^[0-9+\-*/x()]*$/;
  return allowed.test(draft);
};

/** Om hele den kommende procentdraft følger feltets tegn-, decimal- og cifferpolitik. */
export const isPercentDraftAllowed = (
  draft: string,
  options: PercentDraftConstraints = {}
): boolean => {
  const allowNegative = options.allowNegative === true;
  const allowDecimals = options.allowDecimals !== false;
  const maxDecimalDigits = options.maxDecimalDigits ?? 2;
  const pattern = allowDecimals
    ? allowNegative
      ? new RegExp(`^-?\\d*(,\\d{0,${maxDecimalDigits}})?$`)
      : new RegExp(`^\\d*(,\\d{0,${maxDecimalDigits}})?$`)
    : allowNegative
      ? /^-?\d*$/
      : /^\d*$/;
  if (!pattern.test(draft)) return false;

  const normalized = draft.startsWith('-') ? draft.slice(1) : draft;
  const [integerPart] = normalized.split(',') as [string, string?];
  return typeof options.maxIntegerDigits !== 'number'
    || integerPart.length <= options.maxIntegerDigits;
};

/**
 * Årsdraftens tegn- og længdeværn: højst fire cifre, intet andet.
 *
 * Flyttet hertil fra `components/inputs/draftAdmission.ts` 2026-08-18, så BÅDE tastningens
 * `yearAdmission` og pastens `normalizeYearPaste` kan læse det samme prædikat. Modulet
 * `inputPasteNormalization` ligger i `utils` og må ikke importere fra `components`; lå prædikatet
 * fortsat kun dér, ville paste have været nødt til at kopiere regexet – og en kopi er præcis den
 * drift mellem to parallelle værn, `draftAdmission.ts`' egen header advarer om.
 */
export const MAX_YEAR_DRAFT_DIGITS = 4;

export const isYearDraftAllowed = (draft: string): boolean =>
  new RegExp(`^\\d{0,${MAX_YEAR_DRAFT_DIGITS}}$`).test(draft);

/**
 * Ugedraftens tegn- og længdeværn: `UU` + valgfri separator + `ÅÅÅÅ`.
 *
 * Separatoren må være `.`, `,`, `/`, `\` eller `-`; `parseWeekDraftForCommit` normaliserer den til `/`
 * ved settle. Samme flytningsbegrundelse som {@link isYearDraftAllowed}.
 *
 * **Mellemrum er IKKE en separator (brugerbeslutning 2026-08-18).** Det var det før, og kombineret med
 * §1.2a's regel «paste = tastning tegn for tegn» gjorde det en almindelig indsat tekst ubrugelig: i
 * `uge 23/2025` optog mellemrummet efter «uge» separator-pladsen, hvorefter det ægte `/` blev ulovligt
 * (kun én separator er tilladt), og resultatet ` 2320` blev afvist som «Ugyldigt format». Nu er
 * mellemrummet et ulovligt tegn på lige fod med bogstaverne og springes derfor – ved både tastning og
 * paste – så teksten bliver `23/2025`. Prisen er, at `23 2025` ikke længere kan tastes med mellemrum.
 */
/**
 * De lovlige ugeseparatorer, ét sted. `-` står sidst i tegnklassen, så den ikke læses som et interval.
 *
 * Sættet var før erklæret to gange med to FORSKELLIGE indhold: værnet tillod `. , / \ -`, mens
 * settle-parseren kun normaliserede `. : -` (plus mellemrum). `23,2025` kunne derfor tastes, men blev
 * afvist ved settle, og `:` kunne normaliseres men aldrig tastes. Én erklæring, begge læser den.
 */
const WEEK_SEPARATORS = /[.,/\\-]/g;

export const isWeekDraftAllowed = (draft: string): boolean =>
  /^[0-9.,/\\-]*$/.test(draft) && /^\d{0,2}(?:[.,/\\-]\d{0,4})?$/.test(draft);

/** Enhver lovlig ugeseparator → den kanoniske `/`. Bruges af settle-parseren, så de to ikke kan drifte. */
export const normalizeWeekSeparators = (draft: string): string =>
  draft.replace(WEEK_SEPARATORS, '/');

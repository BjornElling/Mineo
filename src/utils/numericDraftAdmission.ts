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

/** Om hele den kommende beløbsdraft kan rumme præcis de tegn, brugeren har skrevet. */
export const isAmountExpressionDraftAllowed = (
  draft: string,
  options: AmountDraftConstraints = {}
): boolean => {
  const allowNegative = options.allowNegative === true;
  const allowDecimals = options.allowDecimals !== false;
  const maxDecimalDigits = options.maxDecimalDigits;

  if (!allowNegative && containsUnaryMinusToken(draft)) return false;
  if (draft.includes('.') || /,,/.test(draft)) return false;
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

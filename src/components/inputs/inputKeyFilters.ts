import type * as React from 'react';
import { readClipboardText } from '../../utils/clipboardUtils';
import { isDateLikeDraftAllowed } from '../../utils/dateDraftNormalization';
import { isFractionDraftAllowed } from '../../utils/fraction';
import { parseDanishNumberString } from '../../utils/numberParsing';

type KeyDownEvent = React.KeyboardEvent<HTMLInputElement>;
type PasteEvent = React.ClipboardEvent<HTMLInputElement>;
type BlockableEvent = { preventDefault(): void; stopPropagation(): void };
type IntegerInputConstraints = Readonly<{
  maxDigits?: number;
  maxValue?: number;
  allowNegative?: boolean;
}>;

const isBypassKeyEvent = (e: KeyDownEvent): boolean => {
  // IME/composition og kommandoer på OS-/browser-niveau må ikke forstyrres.
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  if (native.isComposing === true || e.key === 'Process' || e.key === 'Unidentified') return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return false;
};

const isNonCharacterKey = (e: KeyDownEvent): boolean => {
  // Tillad navigations-/redigeringstaster.
  const nonCharKeys = new Set([
    'Backspace',
    'Delete',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Tab',
  ]);
  return nonCharKeys.has(e.key);
};

const getNextValueFromInsertion = (input: HTMLInputElement, insertion: string): string => {
  const current = input.value ?? '';
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : current.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
  return current.slice(0, start) + insertion + current.slice(end);
};

const wouldInsertAdjacentComma = (input: HTMLInputElement): boolean => {
  const current = input.value ?? '';
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : current.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
  const previousChar = start > 0 ? current[start - 1] : undefined;
  const nextChar = end < current.length ? current[end] : undefined;
  return previousChar === ',' || nextChar === ',';
};

const block = (e: BlockableEvent): void => {
  e.preventDefault();
  e.stopPropagation();
};

const shouldValidateCharInsertion = (e: KeyDownEvent): e is KeyDownEvent & { key: string } => {
  if (isBypassKeyEvent(e)) return false;
  if (isNonCharacterKey(e)) return false;
  if (e.key.length !== 1) return false;
  return true;
};

export const containsUnaryMinusToken = (input: string): boolean => {
  const compact = input.replace(/\s+/g, '');
  return /(^|[+\-*/x(])-/.test(compact);
};

export const isIntegerDraftAllowed = (input: string, options?: IntegerInputConstraints): boolean => {
  const allowNegative = options?.allowNegative === true;
  const pattern = allowNegative ? /^-?\d*$/ : /^\d*$/;
  if (!pattern.test(input)) return false;

  if (typeof options?.maxDigits === 'number') {
    const withoutSign = input.startsWith('-') ? input.slice(1) : input;
    if (withoutSign.length > options.maxDigits) return false;
  }

  if (typeof options?.maxValue === 'number' && /^-?\d+$/.test(input)) {
    const numeric = Number.parseInt(input, 10);
    if (Number.isFinite(numeric) && numeric > options.maxValue) return false;
  }

  return true;
};

/**
 * Heltal: kun cifre.
 */
export const filterIntegerKeyDown = (e: KeyDownEvent, options?: IntegerInputConstraints): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  if (!isIntegerDraftAllowed(next, options)) block(e);
};

/**
 * Heltals-paste-værn der håndhæver de samme begrænsninger som keydown-filtreringen.
 */
export const filterIntegerPaste = (e: PasteEvent, options?: IntegerInputConstraints): void => {
  const text = readClipboardText(e);
  if (text === '') return;
  const next = getNextValueFromInsertion(e.currentTarget, text);
  if (!isIntegerDraftAllowed(next, options)) block(e);
};

/**
 * År: kun cifre, op til 4 cifre (`YYYY`).
 *
 * Dette er kun et værn under indtastning; paste kan stadig omgå det.
 */
export const filterYearKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  if (!/^\d{0,4}$/.test(next)) block(e);
};

/**
 * Brøk: cifre og '/', højst én skråstreg.
 */
export const filterFractionKeyDown = (
  e: KeyDownEvent,
  options?: Readonly<{ maxDigits?: number; allowNegative?: boolean }>
): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  if (!isFractionDraftAllowed(next, options)) block(e);
};

/**
 * Om ET talled i et beløbsudtryk overskrider ciffergrænsen (`input-field-behavior-contract.md` §2.2).
 *
 * Grænsen er pr. TALLED, ikke pr. draft: `9999999+9999999` er lovligt, mens `99999999` ikke er.
 * Derfor skal draften deles op ved operatorer, parenteser og mellemrum, og hvert led måles for sig.
 * Tusindtalsseparatorer findes ikke i et beløbsfelt (punktum er blokeret), så cifrene tælles direkte.
 *
 * Bemærk at dette KUN er en længderegel. Et udtryk, hvis beregnede RESULTAT overskrider
 * `±9.999.999,99`, kan ikke fanges tegn for tegn og bliver i stedet en canonical rød feltfejl ved
 * settle (§2.2, §8) — se `amountResultBoundsValidator`.
 */
const exceedsAmountTokenDigits = (
  draft: string,
  maxIntegerDigits: number,
  maxDecimalDigits: number | undefined
): boolean => {
  // Split ved alt, der ikke kan være en del af ét talled. Minus er både fortegn og operator; i begge
  // tilfælde starter et nyt talled efter det.
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

/**
 * Beløbsudtryk: tillad cifre, ét komma, operatorer, parenteser og mellemrum — og håndhæv
 * ciffergrænsen pr. talled (§2.2: højst 7 heltalscifre og 2 decimaler).
 */
export const filterAmountExpressionKeyDown = (
  e: KeyDownEvent,
  options?: {
    allowNegative?: boolean;
    allowDecimals?: boolean;
    maxDecimalDigits?: number;
    maxIntegerDigits?: number;
  }
): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  const allowNegative = options?.allowNegative === true;
  const allowDecimals = options?.allowDecimals !== false;
  const maxDecimalDigits = options?.maxDecimalDigits;
  if (!allowNegative && containsUnaryMinusToken(next)) {
    block(e);
    return;
  }
  if (e.key === '.') {
    block(e);
    return;
  }
  if (e.key === ',' && wouldInsertAdjacentComma(e.currentTarget)) {
    block(e);
    return;
  }
  if (
    allowDecimals
    && typeof maxDecimalDigits === 'number'
    && Number.isInteger(maxDecimalDigits)
    && maxDecimalDigits >= 0
    && new RegExp(`,\\d{${maxDecimalDigits + 1}}`).test(next)
  ) {
    // Beløbsudtryk kan have flere talled. Værnet kontrollerer derfor hvert decimalkomma i hele den
    // kommende draft i stedet for kun tegnene omkring cursoren.
    block(e);
    return;
  }
  // Ciffergrænsen pr. talled. Måles på hele den kommende draft af samme grund som decimalværnet
  // ovenfor: brugeren kan sætte cursoren midt i et eksisterende talled og skrive der.
  if (
    typeof options?.maxIntegerDigits === 'number'
    && exceedsAmountTokenDigits(
      next,
      options.maxIntegerDigits,
      allowDecimals ? maxDecimalDigits : 0
    )
  ) {
    block(e);
    return;
  }
  const allowed = allowDecimals
    ? /^[0-9+\-*/x(), ]$/
    : /^[0-9+\-*/x() ]$/;
  if (!allowed.test(e.key)) block(e);
};

/**
 * Procent: cifre og komma, højst ét komma, maks. 2 decimaler efter komma,
 * med valgfri begrænsninger på heltalsdelen leveret via options.
 */
export const filterPercentKeyDown = (
  e: KeyDownEvent,
  options?: {
    allowNegative?: boolean;
    maxIntegerDigits?: number;
    maxIntegerPart?: number;
    allowDecimals?: boolean;
    maxValue?: number;
  }
): void => {
  if (!shouldValidateCharInsertion(e)) return;

  const allowNegative = options?.allowNegative === true;
  const allowDecimals = options?.allowDecimals !== false;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);

  const pattern = allowDecimals
    ? allowNegative
      ? /^-?\d*(,\d{0,2})?$/
      : /^\d*(,\d{0,2})?$/
    : allowNegative
      ? /^-?\d*$/
      : /^\d*$/;
  if (!pattern.test(next)) {
    block(e);
    return;
  }

  const normalized = next.startsWith('-') ? next.slice(1) : next;
  const [intPart] = normalized.split(',') as [string, string?];
  if (intPart.length === 0) return;
  if (typeof options?.maxIntegerDigits === 'number' && intPart.length > options.maxIntegerDigits) {
    block(e);
    return;
  }
  const intNum = Number.parseInt(intPart, 10);
  if (typeof options?.maxIntegerPart === 'number' && Number.isFinite(intNum) && intNum > options.maxIntegerPart) {
    block(e);
    return;
  }

  if (typeof options?.maxValue === 'number') {
    const compact = next.replace(/\s+/g, '');
    // Partial decimal input (fx "10,") må passere under typing; commit-validering håndterer endelig værdi.
    if (compact === '' || compact === '-' || compact.endsWith(',')) return;

    const numeric = parseDanishNumberString(compact, { precision: allowDecimals ? 2 : 0 });
    if (numeric !== undefined && numeric > options.maxValue) {
      block(e);
    }
  }
};

/**
 * Dato: cifre og separatortegn, med et værn på segmentlængden der forhindrer
 * 3-cifrede dage/måneder og år på over 4 cifre under indtastning.
 *
 * Tilladte separatorer: ethvert ikke-alfanumerisk tegn (mellemrum og specialtegn).
 * Segmentregler (efter cifre mellem separatorer): `DD`-`MM`-`YYYY` (2-2-4), delvis indtastning tilladt.
 *
 * Dette er kun et værn under indtastning; paste kan stadig omgå det.
 */
export const filterDateLikeKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  if (!isDateLikeDraftAllowed(next, [2, 2, 4])) block(e);
};

/**
 * Uge-input: cifre + én separator, begrænset til `WW-YYYY` efter segmentlængde (2-4).
 *
 * Tilladte separatorer: `. , / \\ - mellemrum`
 * Segmentregler: `WW`-`YYYY`, delvis indtastning tilladt.
 */
export const filterWeekKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  const allowedChars = /^[0-9.,/\\\- ]*$/;
  if (!allowedChars.test(next)) {
    block(e);
    return;
  }

  const segmentGuard = /^\d{0,2}(?:[.,/\\\- ]\d{0,4})?$/;
  if (!segmentGuard.test(next)) block(e);
};

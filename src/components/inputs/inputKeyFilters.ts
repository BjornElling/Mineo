import type * as React from 'react';
import { readClipboardText } from '../../utils/clipboardUtils';
import { isFractionDraftAllowed } from '../../utils/fraction';

type KeyDownEvent = React.KeyboardEvent<HTMLInputElement>;
type PasteEvent = React.ClipboardEvent<HTMLInputElement>;
type BlockableEvent = { preventDefault(): void; stopPropagation(): void };
type IntegerInputConstraints = Readonly<{
  maxDigits?: number;
  maxValue?: number;
  allowNegative?: boolean;
}>;

const isBypassKeyEvent = (e: KeyDownEvent): boolean => {
  // IME/composition and OS/browser-level commands should not be interfered with.
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  if (native.isComposing === true || e.key === 'Process' || e.key === 'Unidentified') return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return false;
};

const isNonCharacterKey = (e: KeyDownEvent): boolean => {
  // Allow navigation/editing keys.
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
 * Integer: digits only.
 */
export const filterIntegerKeyDown = (e: KeyDownEvent, options?: IntegerInputConstraints): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  if (!isIntegerDraftAllowed(next, options)) block(e);
};

/**
 * Integer paste guard that enforces the same constraints as keydown filtering.
 */
export const filterIntegerPaste = (e: PasteEvent, options?: IntegerInputConstraints): void => {
  const text = readClipboardText(e);
  if (text === '') return;
  const next = getNextValueFromInsertion(e.currentTarget, text);
  if (!isIntegerDraftAllowed(next, options)) block(e);
};

/**
 * Year: digits only, up to 4 digits (`YYYY`).
 *
 * This is a typing-time guard only; paste can still bypass.
 */
export const filterYearKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  if (!/^\d{0,4}$/.test(next)) block(e);
};

/**
 * Fraction: digits and '/', at most one slash.
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
 * Amount/Percent: digits and comma, at most one comma, max 2 decimals after comma.
 */
export const filterCommaDecimal2KeyDown = (e: KeyDownEvent, options?: { allowNegative?: boolean }): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  const allowNegative = options?.allowNegative === true;
  const pattern = allowNegative ? /^-?\d*(,\d{0,2})?$/ : /^\d*(,\d{0,2})?$/;
  if (!pattern.test(next)) block(e);
};

/**
 * Amount expressions: allow digits, one comma, operators, parentheses, and spaces.
 */
export const filterAmountExpressionKeyDown = (
  e: KeyDownEvent,
  options?: { allowNegative?: boolean; allowDecimals?: boolean }
): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  const allowNegative = options?.allowNegative === true;
  const allowDecimals = options?.allowDecimals !== false;
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
  const allowed = allowDecimals
    ? /^[0-9+\-*/x(), ]$/
    : /^[0-9+\-*/x() ]$/;
  if (!allowed.test(e.key)) block(e);
};

/**
 * Percent: digits and comma, at most one comma, max 2 decimals after comma,
 * with optional integer-part constraints supplied via options.
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

    const numeric = Number.parseFloat(compact.replace(',', '.'));
    if (Number.isFinite(numeric) && numeric > options.maxValue) {
      block(e);
    }
  }
};

/**
 * Date/Week: digits and a small set of separators (to support flexible typing styles),
 * plus a segment-length guard to prevent 3-digit days/months and >4-digit years during typing.
 *
 * Allowed separators: `. , / \\ - space`
 * Segment rules (by digits between separators): `DD`-`MM`-`YYYY` (2-2-4), partial input allowed.
 *
 * This is a typing-time guard only; paste can still bypass.
 */
export const filterDateLikeKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromInsertion(e.currentTarget, e.key);
  const allowedChars = /^[0-9.,/\\\- ]*$/;
  if (!allowedChars.test(next)) {
    block(e);
    return;
  }

  // Segment-length guard: 0–2 digits, sep, 0–2 digits, optional sep, 0–4 digits.
  const segmentGuard = /^\d{0,2}(?:[.,/\\\- ]\d{0,2}(?:[.,/\\\- ]\d{0,4})?)?$/;
  if (!segmentGuard.test(next)) block(e);
};

/**
 * Week input: digits + one separator, constrained as `WW-YYYY` by segment length (2-4).
 *
 * Allowed separators: `. , / \\ - space`
 * Segment rules: `WW`-`YYYY`, partial input allowed.
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

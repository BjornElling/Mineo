import type * as React from 'react';

type KeyDownEvent = React.KeyboardEvent<HTMLInputElement>;

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

const getNextValueFromKey = (input: HTMLInputElement, key: string): string => {
  const current = input.value ?? '';
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : current.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
  return current.slice(0, start) + key + current.slice(end);
};

const block = (e: KeyDownEvent): void => {
  e.preventDefault();
  e.stopPropagation();
};

const shouldValidateCharInsertion = (e: KeyDownEvent): e is KeyDownEvent & { key: string } => {
  if (isBypassKeyEvent(e)) return false;
  if (isNonCharacterKey(e)) return false;
  if (e.key.length !== 1) return false;
  return true;
};

/**
 * Integer: digits only.
 */
export const filterIntegerKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromKey(e.currentTarget, e.key);
  if (!/^\d*$/.test(next)) block(e);
};

/**
 * Year: digits only, up to 4 digits (`YYYY`).
 *
 * This is a typing-time guard only; paste can still bypass.
 */
export const filterYearKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromKey(e.currentTarget, e.key);
  if (!/^\d{0,4}$/.test(next)) block(e);
};

/**
 * Fraction: digits and '/', at most one slash.
 */
export const filterFractionKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromKey(e.currentTarget, e.key);
  if (!/^\d{0,2}(\/\d{0,2})?$/.test(next)) block(e);
};

/**
 * Amount/Percent: digits and comma, at most one comma, max 2 decimals after comma.
 */
export const filterCommaDecimal2KeyDown = (e: KeyDownEvent, options?: { allowNegative?: boolean }): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const next = getNextValueFromKey(e.currentTarget, e.key);
  const allowNegative = options?.allowNegative === true;
  const pattern = allowNegative ? /^-?\d*(,\d{0,2})?$/ : /^\d*(,\d{0,2})?$/;
  if (!pattern.test(next)) block(e);
};

/**
 * Amount expressions: allow digits, comma/dot, operators, parentheses, and spaces.
 */
export const filterAmountExpressionKeyDown = (e: KeyDownEvent): void => {
  if (!shouldValidateCharInsertion(e)) return;
  const allowed = /^[0-9+\-*/x()., ]$/;
  if (!allowed.test(e.key)) block(e);
};

/**
 * Percent: digits and comma, at most one comma, max 2 decimals after comma,
 * and integer part (absolute) must be <= 100.
 */
export const filterPercentKeyDown = (e: KeyDownEvent, options?: { allowNegative?: boolean }): void => {
  if (!shouldValidateCharInsertion(e)) return;

  const allowNegative = options?.allowNegative === true;
  const next = getNextValueFromKey(e.currentTarget, e.key);

  const pattern = allowNegative ? /^-?\d*(,\d{0,2})?$/ : /^\d*(,\d{0,2})?$/;
  if (!pattern.test(next)) {
    block(e);
    return;
  }

  const normalized = next.startsWith('-') ? next.slice(1) : next;
  const [intPart] = normalized.split(',') as [string, string?];
  if (intPart.length === 0) return;
  if (intPart.length > 3) {
    block(e);
    return;
  }
  const intNum = Number.parseInt(intPart, 10);
  if (Number.isFinite(intNum) && intNum > 100) {
    block(e);
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
  const next = getNextValueFromKey(e.currentTarget, e.key);
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
  const next = getNextValueFromKey(e.currentTarget, e.key);
  const allowedChars = /^[0-9.,/\\\- ]*$/;
  if (!allowedChars.test(next)) {
    block(e);
    return;
  }

  const segmentGuard = /^\d{0,2}(?:[.,/\\\- ]\d{0,4})?$/;
  if (!segmentGuard.test(next)) block(e);
};

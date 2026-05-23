import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { containsUnaryMinusToken, filterAmountExpressionKeyDown } from '../../../components/inputs/inputKeyFilters';
import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
  sanitizePastedAmount,
} from '../../../utils/amountInputUtils';
import { normalizeAmountPaste } from '../../../utils/inputPasteNormalization';
import {
  amountValueToDisplayString,
  amountValueToDraftString,
  formatExpressionErrorMessage,
  parseAmountInput,
} from '../../../utils/expressionAmount';
import { formatRoundedCanonical } from '../../../utils/rounding';
import { makeAmountFingerprintFromCanonical, type AmountFingerprint, type CommittedPayload } from '../../../types/parserSpec';
import type { TableInputAdapter } from '../tableInputAdapter';

export type TableAmountInputValue = AmountValue | undefined;

export type TableAmountAdapterConfig = Readonly<{
  canBeNegative: boolean;
}>;

const commitAmountDraft = (
  draft: string,
  { canBeNegative }: TableAmountAdapterConfig
): { ok: true; value: AmountValue | undefined } | { ok: false; errorMessage: string } => {
  const parsed = parseAmountInput(draft, {
    precision: DEFAULT_AMOUNT_PRECISION,
    allowNegative: canBeNegative,
    maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
    maxRawLength: MAX_AMOUNT_RAW_LENGTH,
  });

  if (parsed.ok) return { ok: true, value: parsed.value };

  if (parsed.error.kind === 'expression') {
    return { ok: false, errorMessage: formatExpressionErrorMessage(parsed.error.message) };
  }
  return { ok: false, errorMessage: parsed.error.message };
};

export const toAmountDisplayString = (value: TableAmountInputValue): string => {
  return amountValueToDisplayString(value, DEFAULT_AMOUNT_PRECISION);
};

export const toAmountDraftString = (value: TableAmountInputValue): string => {
  return amountValueToDraftString(value, DEFAULT_AMOUNT_PRECISION);
};

const amountCanonicalFromModel = (value: TableAmountInputValue): string => {
  if (!value) return '';
  if (value.kind === 'expression') {
    return `e:${value.expression.length}:${value.expression}|${formatRoundedCanonical(value.value, DEFAULT_AMOUNT_PRECISION)}`;
  }
  return `n:${formatRoundedCanonical(value.value, DEFAULT_AMOUNT_PRECISION)}`;
};

export const toCommittedAmountPayload = (
  value: TableAmountInputValue
): CommittedPayload<TableAmountInputValue, string, AmountFingerprint> => {
  const canonical = amountCanonicalFromModel(value);
  return {
    model: value,
    canonical,
    fingerprint: makeAmountFingerprintFromCanonical(canonical),
  };
};

export const createAmountTableInputAdapter = (
  config: TableAmountAdapterConfig
): TableInputAdapter<TableAmountInputValue, string, AmountFingerprint> => ({
  format: toAmountDisplayString,
  toDraftString: toAmountDraftString,
  parse: (draft) => commitAmountDraft(draft, config),
  toCommittedPayload: toCommittedAmountPayload,
  isValidStartKey: (key) => {
    if (!/^[0-9,()-]$/.test(key)) return false;
    if (key === '-' && !config.canBeNegative) return false;
    return true;
  },
  applyPaste: (raw, context) => {
    const normalized = normalizeAmountPaste(raw, { allowNegative: config.canBeNegative });
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    const start = typeof context.selectionStart === 'number' ? context.selectionStart : context.currentDraft.length;
    const end = typeof context.selectionEnd === 'number' ? context.selectionEnd : start;
    const draft = context.currentDraft.slice(0, start) + normalized + context.currentDraft.slice(end);
    if (!config.canBeNegative && containsUnaryMinusToken(draft)) return null;
    return { draft, caretPosition: start + normalized.length };
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    filterAmountExpressionKeyDown(e, { allowNegative: config.canBeNegative });
    return e.defaultPrevented;
  },
  normalizeDraftChange: sanitizePastedAmount,
  preserveInvalidDraft: true,
  clearErrorOnChange: true,
  clearTouchedOnEmptyDraft: true,
  useSaveError: true,
});

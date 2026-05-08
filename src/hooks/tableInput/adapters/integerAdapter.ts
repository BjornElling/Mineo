import { makeIntegerFingerprintFromCanonical, type CommittedPayload, type IntegerFingerprint } from '../../../types/parserSpec';
import { shouldClearField } from '../../../utils/inputValidation';
import { filterIntegerKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeIntegerPaste } from '../../../utils/inputPasteNormalization';
import { getIntegerRangeErrorMessage } from '../../../utils/integerRange';
import { normalizeTableDraftOnCommit } from '../../../utils/tableInputContracts';
import type { TableInputAdapter } from '../tableInputAdapter';

export type TableIntegerInputModel = string;

export type TableIntegerAdapterConfig = Readonly<{
  minValue?: number;
  maxValue?: number;
  maxDigits?: number;
  enforceRange: boolean;
}>;

const parseIntegerOnCommit = (
  draft: string,
  { minValue, maxValue, maxDigits, enforceRange }: TableIntegerAdapterConfig
): { ok: true; value: string; visualErrorMessage?: string } | { ok: false; errorMessage: string } => {
  const trimmed = normalizeTableDraftOnCommit(draft).trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '' };
  if (/[^0-9]/.test(trimmed)) return { ok: false, errorMessage: 'Ugyldigt format' };
  if (typeof maxDigits === 'number' && trimmed.length > maxDigits) return { ok: false, errorMessage: `Maks ${maxDigits} cifre` };

  const numValue = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numValue)) return { ok: false, errorMessage: 'Ugyldigt format' };

  const canonical = String(numValue);
  const rangeError = getIntegerRangeErrorMessage(numValue, minValue, maxValue, { preferExactForEqualBounds: false });
  if (rangeError !== '') {
    if (enforceRange) return { ok: false, errorMessage: rangeError };
    return { ok: true, value: canonical, visualErrorMessage: rangeError };
  }

  return { ok: true, value: canonical };
};

export const toCommittedIntegerPayload = (
  value: TableIntegerInputModel
): CommittedPayload<TableIntegerInputModel, string, IntegerFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: makeIntegerFingerprintFromCanonical(canonical),
  };
};

export const createIntegerTableInputAdapter = (
  config: TableIntegerAdapterConfig
): TableInputAdapter<TableIntegerInputModel, string, IntegerFingerprint> => ({
  format: (value) => value,
  getCommittedVisualError: (value) => {
    if (value === '') return '';
    const numValue = Number.parseInt(value, 10);
    if (!Number.isFinite(numValue)) return '';
    const rangeError = getIntegerRangeErrorMessage(numValue, config.minValue, config.maxValue, { preferExactForEqualBounds: false });
    return config.enforceRange ? '' : rangeError;
  },
  parse: (draft) => parseIntegerOnCommit(draft, config),
  toCommittedPayload: toCommittedIntegerPayload,
  isValidStartKey: (key) => /^[0-9]$/.test(key),
  applyPaste: (raw, context) => {
    const normalized = normalizeIntegerPaste(raw, {
      maxDigits: config.maxDigits,
      maxValue: config.maxValue,
      allowNegative: false,
    });
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    const start = typeof context.selectionStart === 'number' ? context.selectionStart : context.currentDraft.length;
    const end = typeof context.selectionEnd === 'number' ? context.selectionEnd : start;
    const draft = context.currentDraft.slice(0, start) + normalized + context.currentDraft.slice(end);
    return { draft, caretPosition: start + normalized.length };
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    filterIntegerKeyDown(e, { maxDigits: config.maxDigits });
    return e.defaultPrevented;
  },
  preserveInvalidDraft: true,
  clearErrorOnChange: true,
  useSaveError: true,
});

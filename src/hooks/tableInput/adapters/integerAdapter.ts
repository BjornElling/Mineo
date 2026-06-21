import { makeIntegerFingerprintFromCanonical, type CommittedPayload, type IntegerFingerprint } from '../../../types/parserSpec';
import { shouldClearField } from '../../../utils/inputValidation';
import { filterIntegerKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeIntegerPaste } from '../../../utils/inputPasteNormalization';
import { getIntegerRangeErrorMessage } from '../../../utils/integerRange';
import { parseIntegerDraftForCommit } from '../../../utils/integerDraftCore';
import { normalizeTableDraftOnCommit } from '../../../utils/tableInputContracts';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

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
  const normalized = normalizeTableDraftOnCommit(draft);
  if (normalized.trim() === '' || shouldClearField(normalized)) return { ok: true, value: '' };

  // Format-validering deles med formularfeltet via den fælles kerne (ensartet ordlyd, A2).
  const result = parseIntegerDraftForCommit(normalized, { allowNegative: false, maxDigits });
  if (!result.ok) return { ok: false, errorMessage: result.errorMessage };
  const numValue = result.value;
  if (numValue === undefined) return { ok: true, value: '' };

  const canonical = String(numValue);
  const rangeError = getIntegerRangeErrorMessage(numValue, minValue, maxValue);
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
    const rangeError = getIntegerRangeErrorMessage(numValue, config.minValue, config.maxValue);
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

    return spliceDraftPaste(context, normalized);
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    filterIntegerKeyDown(e, { maxDigits: config.maxDigits });
    return e.defaultPrevented;
  },
  preserveInvalidDraft: true,
  useSaveError: true,
});

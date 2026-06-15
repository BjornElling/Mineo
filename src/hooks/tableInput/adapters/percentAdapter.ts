import { formatRoundedCanonical } from '../../../utils/rounding';
import { normalizePercentPaste } from '../../../utils/inputPasteNormalization';
import {
  formatPercentDisplay,
  getPercentPrecision,
  parsePercentDraftForCommit,
  type PercentParseConfig,
} from '../../../utils/percentDraftCore';
import { filterPercentKeyDown } from '../../../components/inputs/inputKeyFilters';
import { normalizeTableNumericDraftOnCommit } from '../../../utils/tableInputContracts';
import { makePercentFingerprintFromCanonical, type CommittedPayload, type PercentFingerprint } from '../../../types/parserSpec';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

export type TablePercentInputModel = number | undefined;

export type TablePercentAdapterConfig = PercentParseConfig;

const percentNumericCanonicalFromModel = (value: TablePercentInputModel, allowDecimals: boolean): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return formatRoundedCanonical(value, getPercentPrecision(allowDecimals));
};

export const createPercentCommittedPayload = (
  value: TablePercentInputModel,
  allowDecimals: boolean
): CommittedPayload<TablePercentInputModel, string, PercentFingerprint> => {
  const canonical = percentNumericCanonicalFromModel(value, allowDecimals);
  return {
    model: value,
    canonical,
    fingerprint: makePercentFingerprintFromCanonical(canonical),
  };
};

export const createPercentTableInputAdapter = (
  config: TablePercentAdapterConfig
): TableInputAdapter<TablePercentInputModel, string, PercentFingerprint> => ({
  format: (value) => formatPercentDisplay(value, config.allowDecimals),
  toClipboardString: (value) => {
    const display = formatPercentDisplay(value, config.allowDecimals);
    return display === '' ? '' : `${display}${INPUT_UNIT_SUFFIX.percent}`;
  },
  parse: (draft) => {
    const normalized = normalizeTableNumericDraftOnCommit(draft);
    const parsed = parsePercentDraftForCommit(normalized, config);
    if (!parsed.ok) return { ok: false, errorMessage: parsed.errorMessage };
    return { ok: true, value: parsed.value };
  },
  toCommittedPayload: (value) => createPercentCommittedPayload(value, config.allowDecimals),
  isValidStartKey: (key) => {
    if (config.allowDecimals) {
      if (!/^[0-9,-]$/.test(key)) return false;
    } else if (!/^[0-9-]$/.test(key)) {
      return false;
    }
    if (key === '-' && !config.allowNegative) return false;
    return true;
  },
  applyPaste: (raw, context) => {
    const normalized = normalizePercentPaste(raw, { maxValue: config.maxValue });
    if (normalized === '') return null;
    if (!context.isEditing) return { draft: normalized };

    return spliceDraftPaste(context, normalized);
  },
  filterKeyDown: (e, context) => {
    if (!context.isEditing) return false;
    filterPercentKeyDown(e, {
      allowNegative: config.allowNegative,
      allowDecimals: config.allowDecimals,
    });
    return e.defaultPrevented;
  },
  preserveInvalidDraft: true,
  useSaveError: true,
});

import { makeStringFingerprintFromCanonical, type CommittedPayload, type StringFingerprint } from '../../../types/parserSpec';
import { trimWhitespaceEdges } from '../../../utils/draftNormalization';
import type { TableInputAdapter } from '../tableInputAdapter';

export type TableTextInputModel = string;

export const toCommittedTextPayload = (
  value: TableTextInputModel
): CommittedPayload<TableTextInputModel, string, StringFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: makeStringFingerprintFromCanonical(canonical),
  };
};

export const textTableInputAdapter: TableInputAdapter<TableTextInputModel, string, StringFingerprint> = {
  format: (value) => value,
  parse: (draft) => ({ ok: true, value: trimWhitespaceEdges(draft) }),
  toCommittedPayload: toCommittedTextPayload,
  isValidStartKey: (key) => key.length === 1,
  preserveInvalidDraft: false,
  useSaveError: false,
};

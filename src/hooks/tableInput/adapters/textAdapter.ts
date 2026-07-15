import { makeStringFingerprintFromCanonical, type CommittedPayload, type StringFingerprint } from '../../../types/parserSpec';
import { textFieldCodec } from '../../../input/fieldCodecs';
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
  format: textFieldCodec.format,
  parse: (draft) => {
    const resolution = textFieldCodec.parseForSettle(draft);
    // Tekstcodecet accepterer alle rå strenge; grenen beskytter adapterkontrakten, hvis codecet ændres senere.
    return resolution.status === 'valid'
      ? { ok: true, value: resolution.value }
      : { ok: false, errorMessage: 'Teksten kunne ikke gemmes' };
  },
  toCommittedPayload: toCommittedTextPayload,
  // Bevar gridets eksisterende aktiveringsregel; første-tast-policy migreres samlet med surface-adapteren.
  isValidStartKey: (key) => key.length === 1,
  preserveInvalidDraft: false,
  useSaveError: false,
};

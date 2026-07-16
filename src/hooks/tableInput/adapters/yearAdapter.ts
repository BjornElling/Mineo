import { makeYearFingerprintFromCanonical, type CommittedPayload, type YearFingerprint } from '../../../types/parserSpec';
import { filterYearKeyDown } from '../../../components/inputs/inputKeyFilters';
import { parseYearDraftForCommit, type TwoDigitYearPolicy } from '../../../utils/yearDraftCore';
import { createStringBackedFieldCodec, createYearFieldCodec } from '../../../input/fieldCodecs';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

const MAX_YEAR_DRAFT_LENGTH = 6; // 4 cifre + tolerance for whitespace før commit-normalisering.

export type TableYearInputModel = string;
export type TableYearPolicy = TwoDigitYearPolicy;

export type TableYearAdapterConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TableYearPolicy;
}>;

export const toCommittedYearPayload = (
  value: TableYearInputModel
): CommittedPayload<TableYearInputModel, string, YearFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: makeYearFingerprintFromCanonical(canonical),
  };
};

export const createYearTableInputAdapter = (
  config: TableYearAdapterConfig
): TableInputAdapter<TableYearInputModel, string, YearFingerprint> => {
  const codec = createStringBackedFieldCodec(createYearFieldCodec(config));

  return {
    format: codec.format,
    parse: (draft) => {
      const resolution = codec.parseForSettle(draft);
      if (resolution.status === 'invalid') {
        const failure = parseYearDraftForCommit(draft, config);
        return {
          ok: false,
          errorMessage: failure.ok ? 'Ugyldigt årstal' : failure.errorMessage,
        };
      }
      const value = resolution.value ?? '';
      return { ok: true, value };
    },
    toCommittedPayload: toCommittedYearPayload,
    isValidStartKey: codec.acceptsInitialKey,
    applyPaste: (raw, context) => {
      const normalized = codec.normalizePaste?.(raw) ?? '';
      if (normalized === '') return null;
      if (!context.isEditing) return { draft: normalized };

      return spliceDraftPaste(context, normalized);
    },
    filterKeyDown: (e, context) => {
      if (!context.isEditing) return false;
      filterYearKeyDown(e);
      return e.defaultPrevented;
    },
    normalizeDraftChange: (draft) => draft.slice(0, MAX_YEAR_DRAFT_LENGTH),
    preserveInvalidDraft: true,
    useSaveError: true,
  };
};

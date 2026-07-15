import { makeWeekFingerprintFromCanonical, type CommittedPayload, type WeekFingerprint } from '../../../types/parserSpec';
import { filterWeekKeyDown } from '../../../components/inputs/inputKeyFilters';
import { parseWeekDraftForCommit } from '../../../utils/weekDraftCore';
import type { TwoDigitYearPolicy } from '../../../utils/yearDraftCore';
import { createStringBackedFieldCodec, createWeekFieldCodec } from '../../../input/fieldCodecs';
import { trimToAlphanumericEdges } from '../../../utils/draftNormalization';
import { spliceDraftPaste, type TableInputAdapter } from '../tableInputAdapter';

const MAX_WEEK_DRAFT_LENGTH = 8;

export type TableWeekInputModel = string;

export type TableWeekAdapterConfig = Readonly<{
  minYear?: number;
  maxYear?: number;
  twoDigitYearPolicy: TwoDigitYearPolicy;
}>;

export const toCommittedWeekPayload = (
  value: TableWeekInputModel
): CommittedPayload<TableWeekInputModel, string, WeekFingerprint> => {
  const canonical = value;
  return {
    model: canonical,
    canonical,
    fingerprint: makeWeekFingerprintFromCanonical(canonical),
  };
};

export const createWeekTableInputAdapter = (
  config: TableWeekAdapterConfig
): TableInputAdapter<TableWeekInputModel, string, WeekFingerprint> => {
  const codec = createStringBackedFieldCodec(createWeekFieldCodec({
    ...config,
    maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
  }));

  return {
    format: codec.format,
    parse: (draft) => {
      const resolution = codec.parseForSettle(draft);
      if (resolution.status === 'invalid') {
        const failure = parseWeekDraftForCommit(trimToAlphanumericEdges(draft), {
          twoDigitYearPolicy: config.twoDigitYearPolicy,
          maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
        });
        return {
          ok: false,
          errorMessage: failure.ok ? 'Ugyldigt format' : failure.errorMessage,
        };
      }
      const value = resolution.value ?? '';
      if (value === '') return { ok: true, value };

      // Bevar den eksisterende commit-blokering, indtil fase 5 flytter bounds til den rene issue-model.
      const bounded = parseWeekDraftForCommit(value, {
        ...config,
        twoDigitYearPolicy: 'reject',
        maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
      });
      return bounded.ok
        ? { ok: true, value }
        : { ok: false, errorMessage: bounded.errorMessage };
    },
    toCommittedPayload: toCommittedWeekPayload,
    isValidStartKey: codec.acceptsInitialKey,
    applyPaste: (raw, context) => {
      const normalized = codec.normalizePaste?.(raw) ?? '';
      if (normalized === '') return null;
      if (!context.isEditing) return { draft: normalized };

      return spliceDraftPaste(context, normalized);
    },
    filterKeyDown: (e, context) => {
      if (!context.isEditing) return false;
      if (context.hasError) return false;
      filterWeekKeyDown(e);
      return e.defaultPrevented;
    },
    normalizeDraftChange: (draft) => draft.slice(0, MAX_WEEK_DRAFT_LENGTH),
    preserveInvalidDraft: true,
    useSaveError: true,
  };
};

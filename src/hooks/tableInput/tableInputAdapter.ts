import type * as React from 'react';

import type { CommittedPayload } from '../../types/parserSpec';

export type TableAdapterParseResult<TModel> =
  | Readonly<{ ok: true; value: TModel; visualErrorMessage?: string }>
  | Readonly<{ ok: false; errorMessage: string }>;

export type TableInputPasteResult = Readonly<{
  draft: string;
  caretPosition?: number;
}> | null;

export type TableInputAdapter<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  format: (value: TModel) => string;
  toDraftString?: (value: TModel) => string;
  parse: (draft: string) => TableAdapterParseResult<TModel>;
  toCommittedPayload: (value: TModel) => CommittedPayload<TModel, TCanonical, TFingerprint>;
  isValidStartKey: (key: string) => boolean;
  applyPaste?: (
    raw: string,
    context: Readonly<{
      currentDraft: string;
      isEditing: boolean;
      selectionStart: number | null;
      selectionEnd: number | null;
    }>
  ) => TableInputPasteResult;
  filterKeyDown?: (
    e: React.KeyboardEvent<HTMLInputElement>,
    context: Readonly<{ isEditing: boolean; hasError: boolean }>
  ) => boolean;
  normalizeDraftChange?: (draft: string) => string;
  /**
   * Controls whether a non-committable draft survives committed-value resyncs.
   *
   * Default: true. Set to false only for inputs where every draft is committable
   * and stale local draft text should immediately yield to the committed value.
   */
  preserveInvalidDraft?: boolean;
  /**
   * Controls whether a successfully committed draft with visual-only validation
   * error (for example an allowed but out-of-range date) stays visible after
   * committed-value resync.
   *
   * Default: true. Set to false when the committed display value is the canonical
   * UI representation and the draft form should not be kept solely because the
   * field has a visual validation error.
   */
  preserveVisualErrorDraft?: boolean;
  /**
   * Clears local input/save error state as soon as the user edits the draft.
   *
   * Default: false. Use for constrained inputs where typing is expected to be a
   * fresh correction attempt. It does not validate or commit during onChange.
   */
  clearErrorOnChange?: boolean;
  /**
   * Clears touched state when the user edits the draft to an empty string.
   *
   * Default: false. Use for inputs whose empty draft should temporarily remove
   * the red commit-error UI until the next explicit commit.
   */
  clearTouchedOnEmptyDraft?: boolean;
  /**
   * Registers non-committable input errors with the save-error registry.
   *
   * Default: false. Enable for table inputs where an invalid draft must block
   * save until the user commits a valid value or cancels/restores the draft.
   */
  useSaveError?: boolean;
}>;

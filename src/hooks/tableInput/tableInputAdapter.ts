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
  preserveInvalidDraft?: boolean;
  preserveVisualErrorDraft?: boolean;
  clearErrorOnChange?: boolean;
  useSaveError?: boolean;
}>;

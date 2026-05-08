import type * as React from 'react';

import type { CommittedPayload } from '../../types/parserSpec';

export type TableAdapterParseResult<TModel> =
  | Readonly<{ ok: true; value: TModel }>
  | Readonly<{ ok: false; errorMessage: string }>;

export type TableInputAdapter<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  format: (value: TModel) => string;
  parse: (draft: string) => TableAdapterParseResult<TModel>;
  toCommittedPayload: (value: TModel) => CommittedPayload<TModel, TCanonical, TFingerprint>;
  isValidStartKey: (key: string) => boolean;
  normalizePaste?: (raw: string, context: Readonly<{ currentDraft: string }>) => string | null;
  filterKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => boolean;
  preserveInvalidDraft?: boolean;
  useSaveError?: boolean;
}>;

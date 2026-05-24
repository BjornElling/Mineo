// Mineo field events are NOT DOM events. They are intentionally minimal, serializable payloads.
// Brand them to avoid accidental mixing with React/MUI events in larger codebases.

export type MineoFieldEventKind = 'draft' | 'commit';

export type MineoFieldEventBrand<TKind extends MineoFieldEventKind> = Readonly<{
  __mineoEvent: 'MineoFieldEvent';
  kind: TKind;
}>;

export type DraftChangeEvent = MineoFieldEventBrand<'draft'> & { target: { value: string } };

export type CommitEvent<TValue> = MineoFieldEventBrand<'commit'> & { target: { value: TValue } };

export type DraftChangeHandler = (e: DraftChangeEvent) => void;

export type CommitHandler<TValue> = (e: CommitEvent<TValue>) => void;

export type DraftParseMode = 'typing' | 'commit';

export type DraftParseErrorKind = 'empty' | 'partial' | 'invalid';

export type DraftParseResult<TModel> =
  | { ok: true; value: TModel }
  | { ok: false; kind: 'invalid'; message: string }
  | { ok: false; kind: Exclude<DraftParseErrorKind, 'invalid'>; message?: string };

export type DraftParse<TModel> = (draft: string, context: { mode: DraftParseMode }) => DraftParseResult<TModel>;

export const createDraftChangeEvent = (value: string): DraftChangeEvent => ({
  __mineoEvent: 'MineoFieldEvent',
  kind: 'draft',
  target: { value },
});

export const createCommitEvent = <TValue>(value: TValue): CommitEvent<TValue> => ({
  __mineoEvent: 'MineoFieldEvent',
  kind: 'commit',
  target: { value },
});

/**
 * Field blur invariant (Mineo):
 * - Styled*Field components wire internal `useDraftField.onBlur` first.
 * - The external `onBlur` (React focus event) runs after internal blur handling.
 *
 * Implication:
 * - `onBlur` MUST NOT be treated as the "commit" callback.
 * - Any commit attempt caused by blur has already been processed before `onBlur` runs
 *   (it may have been suppressed via Escape/Enter policies).
 */

// MinEO field events are NOT DOM events. They are intentionally minimal, serializable payloads.
// Brand them to avoid accidental mixing with React/MUI events in larger codebases.

export type MinEOFieldEventKind = 'draft' | 'commit';

export type MinEOFieldEventBrand<TKind extends MinEOFieldEventKind> = Readonly<{
  __mineoEvent: 'MinEOFieldEvent';
  kind: TKind;
}>;

export type DraftChangeEvent = MinEOFieldEventBrand<'draft'> & { target: { value: string } };

export type CommitEvent<TValue> = MinEOFieldEventBrand<'commit'> & { target: { value: TValue } };

export type DraftChangeHandler = (e: DraftChangeEvent) => void;

export type CommitHandler<TValue> = (e: CommitEvent<TValue>) => void;

export const createDraftChangeEvent = (value: string): DraftChangeEvent => ({
  __mineoEvent: 'MinEOFieldEvent',
  kind: 'draft',
  target: { value },
});

export const createCommitEvent = <TValue>(value: TValue): CommitEvent<TValue> => ({
  __mineoEvent: 'MinEOFieldEvent',
  kind: 'commit',
  target: { value },
});

/**
 * Field blur invariant (MinEO):
 * - Styled*Field components wire internal `useDraftField.onBlur` first.
 * - The external `onBlur` (React focus event) runs after internal blur handling.
 *
 * Implication:
 * - `onBlur` MUST NOT be treated as the "commit" callback.
 * - Any commit attempt caused by blur has already been processed before `onBlur` runs
 *   (it may have been suppressed via Escape/Enter policies).
 */

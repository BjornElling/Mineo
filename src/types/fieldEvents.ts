// Mineos field events er IKKE DOM-events. De er bevidst minimale, serialiserbare payloads.
// De brandes for at undgå utilsigtet sammenblanding med React/MUI-events i større kodebaser.

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
 * Field blur-invariant (Mineo):
 * - Styled*Field-komponenter kobler den interne `useDraftField.onBlur` først.
 * - Den eksterne `onBlur` (React focus event) kører efter den interne blur-håndtering.
 *
 * Konsekvens:
 * - `onBlur` MÅ IKKE behandles som "commit"-callback.
 * - Ethvert commit-forsøg udløst af blur er allerede behandlet, før `onBlur` kører
 *   (det kan være blevet undertrykt via Escape-/Enter-politikker).
 */

import * as React from 'react';
import { isInteractiveDevLoggingEnabled } from '../utils/debugRuntime';
import { registerDraftHistoryController, type DraftHistoryRestoreState } from '../utils/draftHistoryRegistry';
import type {
  DraftParse,
  DraftParseErrorKind,
} from '../types/fieldEvents';

export type {
  DraftParse,
  DraftParseErrorKind,
  DraftParseMode,
  DraftParseResult,
} from '../types/fieldEvents';

const defaultNormalizeDraftOnCommit = (draft: string): string => {
  return draft;
};

export type DraftFieldError =
  | { kind: 'invalid'; message: string; invalidDraft?: string }
  | { kind: Exclude<DraftParseErrorKind, 'invalid'>; message?: string; invalidDraft?: string };

export type UseDraftFieldConfig<TModel> = {
  value: TModel;

  /**
   * Must be deterministic and stable for semantically equivalent values.
   *
   * The hook uses `format(value)` snapshots to detect parent updates after a commit; if `format` can vary
   * across renders for the same value (e.g. locale/timezone-dependent output), draft resync behavior
   * becomes unpredictable.
   *
   * Practical requirement:
   * - `format` should be the field's canonical committed representation (what the user should see after commit).
   * - `format` must not collapse distinct committed values within the semantics of the field, otherwise parent
   *   updates may be missed (because resync detection is string-based).
   */
  format: (value: TModel) => string;
  parse: DraftParse<TModel>;
  normalizeDraftOnCommit?: (draft: string) => string;
  onCommit: (nextValue: TModel) => void;

  /**
   * Optional ref to the actual input/textarea DOM element controlled by this hook.
   *
   * Mineo invariant: draft MUST NOT be overwritten by parent-driven resync while the control
   * is physically focused in the DOM. React focus state can lag during rapid tab navigation.
   */
  inputElementRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;

  commitOnBlur?: boolean;
  commitOnEnter?: boolean;

  clearErrorOnDraftChange?: boolean;
  initialInvalidDraft?: Readonly<{
    draft: string;
    message: string;
  }>;
  /**
   * UX policy: when the draft becomes empty, treat it as "no validation state".
   * This clears local error + touched without committing or parsing.
   */
  clearTouchedOnEmptyDraft?: boolean;
};

export type UseDraftFieldResult = {
  draft: string;
  setDraft: (nextDraft: string) => void;
  isFocused: boolean;

  /**
   * Semantic: "has a commit been attempted?" (not "has the user interacted?").
   * Used to gate when parse errors should be shown.
   */
  touched: boolean;
  error: DraftFieldError | undefined;

  onFocus: () => void;
  onBlur: (_e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  /**
   * Imperative commit attempt of the current draft.
   *
   * Note: this does not apply blur-suppression. If you call `commit()` from an event that may also cause
   * an `onBlur` (e.g. mouse click outside), rely on the hook's own `onBlur`/`onKeyDown` wiring or manage
   * suppression externally.
   */
  commit: () => void;
  commitDraft: (nextDraft: string) => void;
  cancel: () => void;
};

export const useDraftField = <TModel>(config: UseDraftFieldConfig<TModel>): UseDraftFieldResult => {
  const {
    value,
    format,
    parse,
    normalizeDraftOnCommit,
    onCommit,
    inputElementRef,
    commitOnBlur = true,
    commitOnEnter = true,
    clearErrorOnDraftChange = true,
    clearTouchedOnEmptyDraft = false,
  } = config;

  /**
   * Internal state invariants (Mineo):
   * - Consumers must use `setDraft` (not `setDraftState`) so blur-suppression + pending-resync bookkeeping stays correct.
   * - After Escape-cancel or Enter-commit, a blur may follow in the same interaction; suppression must be one-shot and
   *   applies to the immediately following blur-triggered commit attempt.
   * - Post-commit resync intentionally trades simplicity for determinism. Do not refactor unless all scenarios are understood.
   */
  const [isFocused, setIsFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(() => config.initialInvalidDraft !== undefined);
  const [error, setError] = React.useState<DraftFieldError | undefined>(() =>
    config.initialInvalidDraft
      ? { kind: 'invalid', message: config.initialInvalidDraft.message, invalidDraft: config.initialInvalidDraft.draft }
      : undefined
  );
  const [draft, setDraftState] = React.useState<string>(() => config.initialInvalidDraft?.draft ?? format(value));

  const committedValueRef = React.useRef(value);
  React.useLayoutEffect(() => {
    committedValueRef.current = value;
  }, [value]);
  const isFocusedRef = React.useRef(isFocused);
  React.useLayoutEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Snapshot of the field state at focus start (pre-edit).
  // Used to ensure Escape restores the exact "existing value" the user started editing,
  // even when that value is currently invalid (i.e. not representable by the committed model).
  const focusSnapshotRef = React.useRef<{
    draft: string;
    touched: boolean;
    error: DraftFieldError | undefined;
  } | null>(null);

  // After Escape-cancel or Enter-commit, a blur may follow in the same interaction.
  // Invariant: cancel must never lead to commit, and Enter must not double-commit via blur.
  //
  // Policy: suppression is one-shot for the next blur-commit, and is cleared either:
  // - when consumed by `onBlur`, or
  // - when the user changes the draft again (new interaction).
  const suppressNextBlurCommitRef = React.useRef(false);
  const pendingValueResyncRef = React.useRef<
    | { active: false }
    | {
        active: true;
        formattedValueAtCommit: string;
        draftAfterLocalFormat: string;
        userEditedSinceCommit: boolean;
      }
  >({ active: false });
  const pendingHistoryValueResyncRef = React.useRef(false);

  const restoreFromHistory = React.useCallback((state: DraftHistoryRestoreState) => {
    const committedAtCallTime = committedValueRef.current;
    const formattedAtCallTime = format(committedAtCallTime);

    pendingValueResyncRef.current = { active: false };
    // Gate suppression on focus: undo/redo restore should only reach here after MainLayout
    // has allowed a committed-state restore. If a focused field receives restore anyway,
    // avoid silently overriding blur-commit semantics.
    if (!isFocusedRef.current) {
      suppressNextBlurCommitRef.current = true;
    }
    if (state.kind === 'error') {
      pendingHistoryValueResyncRef.current = false;
      setDraftState(state.draft);
      setTouched(true);
      setError(state.error);
      return;
    }

    pendingHistoryValueResyncRef.current = true;
    setDraftState(formattedAtCallTime);
    setTouched(false);
    setError(undefined);
  }, [format]);

  React.useEffect(() => {
    const element = inputElementRef?.current;
    if (!element) return undefined;
    const focusToken = element.getAttribute('data-mineo-undo-focus-token');
    const fieldPath = element.getAttribute('data-mineo-undo-field-path');
    return registerDraftHistoryController(
      { focusToken, fieldPath },
      { restoreFromHistory }
    );
  }, [inputElementRef, restoreFromHistory]);

  const debugDepsRef = React.useRef<{ error: typeof error; format: typeof format; isFocused: boolean; touched: boolean; value: TModel } | null>(null);
  React.useEffect(() => {
    if (isInteractiveDevLoggingEnabled) {
      const prev = debugDepsRef.current;
      if (prev !== null) {
        const changed: string[] = [];
        if (prev.error !== error) changed.push(`error (${JSON.stringify(prev.error)} → ${JSON.stringify(error)})`);
        if (prev.format !== format) changed.push('format (fn reference changed)');
        if (prev.isFocused !== isFocused) changed.push(`isFocused (${prev.isFocused} → ${isFocused})`);
        if (prev.touched !== touched) changed.push(`touched (${prev.touched} → ${touched})`);
        if (prev.value !== value) changed.push(`value (${JSON.stringify(prev.value)} → ${JSON.stringify(value)})`);
        if (changed.length > 0) {
          console.debug('[useDraftField] resync-effect triggered. Changed deps:', changed.join(', '));
        }
      }
      debugDepsRef.current = { error, format, isFocused, touched, value };
    }

    const formatted = format(value);
    const el = inputElementRef?.current ?? null;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const hasPhysicalFocus =
      el !== null &&
      active !== null &&
      (active === el || (el instanceof HTMLElement && active instanceof Node && el.contains(active)));
    const isEffectivelyFocused = isFocused || hasPhysicalFocus;

    setDraftState((prev) => {
      const pending = pendingValueResyncRef.current;

      if (pendingHistoryValueResyncRef.current) {
        return prev === formatted ? prev : formatted;
      }

      if (pending.active) {
        // While we are waiting for the post-commit `value` update, never sync draft from `value`
        // (avoids flicker and overwriting the local post-commit formatting).
        const valueHasUpdatedSinceCommit = formatted !== pending.formattedValueAtCommit;
        if (!valueHasUpdatedSinceCommit) {
          if (formatted === pending.draftAfterLocalFormat) pendingValueResyncRef.current = { active: false };
          return prev;
        }

        pendingValueResyncRef.current = { active: false };

        if (pending.userEditedSinceCommit) {
          return prev;
        }

        // Only sync while focused if the user hasn't typed since we locally formatted after commit.
        if (isEffectivelyFocused && prev !== pending.draftAfterLocalFormat) {
          return prev;
        }

        return prev === formatted ? prev : formatted;
      }

      if (isEffectivelyFocused) return prev;
      // If the last commit attempt failed, preserve the user's invalid draft even while unfocused.
      // This prevents "silent rollback" to the last committed value on blur.
      if (touched && error !== undefined) return prev;

      return prev === formatted ? prev : formatted;
    });
  }, [error, format, inputElementRef, isFocused, touched, value]);

  const setDraft = React.useCallback(
    (nextDraft: string) => {
      pendingHistoryValueResyncRef.current = false;
      setDraftState(nextDraft);

      suppressNextBlurCommitRef.current = false;
      const pending = pendingValueResyncRef.current;
      if (pending.active) {
        pendingValueResyncRef.current = { ...pending, userEditedSinceCommit: true };
      }

      if (clearErrorOnDraftChange) {
        setError(undefined);
      }
      if (clearTouchedOnEmptyDraft && nextDraft === '') {
        setError(undefined);
        setTouched(false);
      }
    },
    [clearErrorOnDraftChange, clearTouchedOnEmptyDraft]
  );

  const cancel = React.useCallback(() => {
    pendingHistoryValueResyncRef.current = false;
    const snapshot = focusSnapshotRef.current;
    if (snapshot) {
      setDraftState(snapshot.draft);
      setTouched(snapshot.touched);
      setError(snapshot.error);
    } else {
      const formatted = format(committedValueRef.current);
      setDraftState(formatted);
      setError(undefined);
      setTouched(false);
    }
    suppressNextBlurCommitRef.current = true;
    pendingValueResyncRef.current = { active: false };
  }, [format]);

  const commitFromDraft = React.useCallback((rawDraft: string, source: 'blur' | 'enter' | 'imperative') => {
    pendingHistoryValueResyncRef.current = false;
    setTouched(true);

    const draftForCommit = (normalizeDraftOnCommit ?? defaultNormalizeDraftOnCommit)(rawDraft);
    const result = parse(draftForCommit, { mode: 'commit' });

    if (result.ok) {
      const formattedValueAtCommit = format(value);
      onCommit(result.value);
      const formatted = format(result.value);
      pendingValueResyncRef.current = {
        active: true,
        formattedValueAtCommit,
        draftAfterLocalFormat: formatted,
        userEditedSinceCommit: false,
      };
      setDraftState(formatted);
      setError(undefined);
      return;
    }

    if (result.kind === 'invalid') {
      setError({ kind: result.kind, message: result.message, invalidDraft: draftForCommit });
      return;
    }

    // Contract guard:
    // In commit mode, non-committable values should be surfaced deterministically.
    // If a field returns `partial/empty` without a message on commit, it will appear as a "silent failure".
    if (isInteractiveDevLoggingEnabled && result.message === undefined) {
      throw new Error(
        `useDraftField.parse(commit) returned kind='${result.kind}' without message (commit source: ${source})`
      );
    }

    if (result.message === undefined) {
      setError(undefined);
      return;
    }

    setError({ kind: result.kind, message: result.message, invalidDraft: draftForCommit });
  }, [format, normalizeDraftOnCommit, onCommit, parse, value]);

  const commit = React.useCallback(() => {
    commitFromDraft(draft, 'imperative');
  }, [commitFromDraft, draft]);

  const commitDraft = React.useCallback((nextDraft: string) => {
    suppressNextBlurCommitRef.current = true;
    pendingValueResyncRef.current = { active: false };
    setDraftState(nextDraft);
    commitFromDraft(nextDraft, 'imperative');
  }, [commitFromDraft]);

  const shouldBubbleEnterForNavigation = React.useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return target.closest('[data-mineo-scroll-container="true"], table') !== null;
  }, []);

  const onFocus = React.useCallback(() => {
    setIsFocused(true);
    focusSnapshotRef.current = { draft, touched, error };
  }, [draft, error, touched]);

  const onBlur = React.useCallback((_e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsFocused(false);
    focusSnapshotRef.current = null;

    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    if (commitOnBlur) {
      commitFromDraft(draft, 'blur');
    }
  }, [commitFromDraft, commitOnBlur, draft]);

  const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      suppressNextBlurCommitRef.current = true;
      cancel();
      return;
    }

    if (e.key === 'Enter' && commitOnEnter) {
      e.preventDefault();
      // IMPORTANT:
      // Enter must bubble for Container/table-owned traversal.
      // Outside those contexts (e.g. dialogs/overlays), handle locally.
      if (!shouldBubbleEnterForNavigation(e.target)) {
        e.stopPropagation();
      }
      suppressNextBlurCommitRef.current = true;
      commitFromDraft(draft, 'enter');
    }
  }, [cancel, commitFromDraft, commitOnEnter, draft, shouldBubbleEnterForNavigation]);

  return {
    draft,
    setDraft,
    isFocused,
    touched,
    error,
    onFocus,
    onBlur,
    onKeyDown,
    commit,
    commitDraft,
    cancel,
  };
};

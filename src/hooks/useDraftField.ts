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
   * Skal være deterministisk og stabil for semantisk ækvivalente værdier.
   *
   * Hooken bruger `format(value)`-snapshots til at detektere parent-opdateringer efter et commit; hvis `format`
   * kan variere på tværs af renders for den samme værdi (fx locale-/tidszoneafhængigt output), bliver
   * draft-resync-adfærden uforudsigelig.
   *
   * Praktisk krav:
   * - `format` bør være feltets kanoniske committed-repræsentation (det brugeren bør se efter commit).
   * - `format` må ikke kollapse distinkte committed-værdier inden for feltets semantik, ellers kan parent-
   *   opdateringer blive overset (fordi resync-detektion er streng-baseret).
   */
  format: (value: TModel) => string;
  parse: DraftParse<TModel>;
  normalizeDraftOnCommit?: (draft: string) => string;
  onCommit: (nextValue: TModel) => void;

  /**
   * Valgfri ref til det egentlige input-/textarea-DOM-element, som denne hook styrer.
   *
   * Mineo-invariant: draft MÅ IKKE overskrives af parent-drevet resync, mens kontrollen
   * er fysisk fokuseret i DOM'en. Reacts focus state kan lagge under hurtig tab-navigation.
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
   * UX-politik: når draften bliver tom, behandl det som "ingen valideringstilstand".
   * Dette rydder lokal error + touched uden at committe eller parse.
   */
  clearTouchedOnEmptyDraft?: boolean;
};

export type UseDraftFieldResult = {
  draft: string;
  setDraft: (nextDraft: string) => void;
  isFocused: boolean;

  /**
   * Semantik: "er der forsøgt et commit?" (ikke "har brugeren interageret?").
   * Bruges til at gate, hvornår parse-fejl skal vises.
   */
  touched: boolean;
  error: DraftFieldError | undefined;

  onFocus: () => void;
  onBlur: (_e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  /**
   * Imperativt commit-forsøg på den nuværende draft.
   *
   * Bemærk: dette anvender ikke blur-suppression. Hvis du kalder `commit()` fra en event, der også kan
   * udløse en `onBlur` (fx museklik udenfor), så stol på hookens egen `onBlur`/`onKeyDown`-wiring eller
   * håndtér suppression eksternt.
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
   * Interne state-invarianter (Mineo):
   * - Consumere skal bruge `setDraft` (ikke `setDraftState`), så blur-suppression + pending-resync-bogføring forbliver korrekt.
   * - Efter Escape-cancel eller Enter-commit kan en blur følge i samme interaktion; suppression skal være one-shot og
   *   gælder det umiddelbart efterfølgende blur-udløste commit-forsøg.
   * - Post-commit-resync bytter bevidst enkelhed for determinisme. Refaktorér ikke, medmindre alle scenarier er forstået.
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

  // Snapshot af feltets state ved fokus-start (før redigering).
  // Bruges til at sikre, at Escape gendanner præcis den "eksisterende værdi", brugeren begyndte at redigere,
  // selv når den værdi aktuelt er ugyldig (dvs. ikke repræsenterbar af den committede model).
  const focusSnapshotRef = React.useRef<{
    draft: string;
    touched: boolean;
    error: DraftFieldError | undefined;
  } | null>(null);

  // Efter Escape-cancel eller Enter-commit kan en blur følge i samme interaktion.
  // Invariant: cancel må aldrig føre til commit, og Enter må ikke dobbelt-committe via blur.
  //
  // Politik: suppression er one-shot for det næste blur-commit og ryddes enten:
  // - når den forbruges af `onBlur`, eller
  // - når brugeren ændrer draften igen (ny interaktion).
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
  // Sporer `value`-proppen på det tidspunkt, vi senest bevarede en ugyldig draft pga. touched+error.
  // Når `value` ændres eksternt (fx InsertTodayDateButton), forbigås guarden.
  const valueAtInvalidDraftPreserveRef = React.useRef<TModel>(value);

  const restoreFromHistory = React.useCallback((state: DraftHistoryRestoreState) => {
    const committedAtCallTime = committedValueRef.current;
    const formattedAtCallTime = format(committedAtCallTime);

    pendingValueResyncRef.current = { active: false };
    // Gate suppression på fokus: undo/redo-restore bør kun nå hertil, efter MainLayout
    // har tilladt en committed-state-restore. Hvis et fokuseret felt alligevel modtager restore,
    // undgå stiltiende at tilsidesætte blur-commit-semantikken.
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

    // Ekstern value-opdatering, mens feltet holder en ugyldig draft (fx InsertTodayDateButton):
    // ryd error-state, så resync nedenfor kan synce til den nye værdi.
    if (touched && error !== undefined && value !== valueAtInvalidDraftPreserveRef.current) {
      setTouched(false);
      setError(undefined);
      valueAtInvalidDraftPreserveRef.current = value;
      setDraftState(formatted);
      return;
    }

    setDraftState((prev) => {
      const pending = pendingValueResyncRef.current;

      if (pendingHistoryValueResyncRef.current) {
        return prev === formatted ? prev : formatted;
      }

      if (pending.active) {
        // Mens vi venter på post-commit-`value`-opdateringen, synk aldrig draft fra `value`
        // (undgår flicker og overskrivning af den lokale post-commit-formattering).
        const valueHasUpdatedSinceCommit = formatted !== pending.formattedValueAtCommit;
        if (!valueHasUpdatedSinceCommit) {
          if (formatted === pending.draftAfterLocalFormat) pendingValueResyncRef.current = { active: false };
          return prev;
        }

        pendingValueResyncRef.current = { active: false };

        if (pending.userEditedSinceCommit) {
          return prev;
        }

        // Synk kun mens fokuseret, hvis brugeren ikke har tastet, siden vi lokalt formatterede efter commit.
        if (isEffectivelyFocused && prev !== pending.draftAfterLocalFormat) {
          return prev;
        }

        return prev === formatted ? prev : formatted;
      }

      if (isEffectivelyFocused) return prev;
      // Hvis det seneste commit-forsøg fejlede, bevar brugerens ugyldige draft selv mens ufokuseret.
      // Dette forhindrer "silent rollback" til den senest committede værdi ved blur.
      if (touched && error !== undefined) {
        valueAtInvalidDraftPreserveRef.current = value;
        return prev;
      }

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

    // Kontrakt-guard:
    // I commit-mode bør ikke-committbare værdier overflades deterministisk.
    // Hvis et felt returnerer `partial/empty` uden en message ved commit, vil det fremstå som en "silent failure".
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
      // VIGTIGT:
      // Enter skal bubble for Container-/tabel-ejet traversal.
      // Uden for de kontekster (fx dialogs/overlays), håndtér lokalt.
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

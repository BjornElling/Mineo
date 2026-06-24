import * as React from 'react';
import type {
  DraftParse,
  DraftParseErrorKind,
} from '../types/fieldEvents';
import { useAuthoritativeSnapshotEpochSelector } from './useFormPersistenceSelectors';
import { isRestoreFocusInProgress } from '../utils/historyTargetRestore';

export type {
  DraftParse,
  DraftParseErrorKind,
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
   * Skal være deterministisk og stabil for semantisk ækvivalente værdier (feltets kanoniske
   * committed-repræsentation).
   */
  format: (value: TModel) => string;
  parse: DraftParse<TModel>;
  normalizeDraftOnCommit?: (draft: string) => string;

  /** Kaldes ved vellykket commit. */
  onCommit: (nextValue: TModel) => void;

  /**
   * Kaldes ved fejlende (ikke-committbart) commit med den rå draft.
   *
   * Når sat (bundet felt) ejer kalderen persisteringen af den rå draft i `invalidDrafts` og leverer
   * den tilbage via `committedInvalidDraft`. Når den ikke er sat (ubundet felt, fx i settings),
   * holder hooken selv en lokal fallback, så den ugyldige draft ikke silent-rolles-tilbage ved blur.
   */
  onCommitInvalid?: (rawDraft: string) => void;

  /**
   * Den persisterede committede rå draft for feltet (fra `invalidDrafts`-storen). Er feltets
   * autoritative "ikke-committbare" tilstand for bundne felter; driver resync + fejlvisning.
   */
  committedInvalidDraft?: string;

  /**
   * Valgfri ref til input-/textarea-DOM-elementet. Mineo-invariant: draft MÅ IKKE overskrives af
   * ekstern resync, mens kontrollen er fysisk fokuseret (Reacts focus state kan lagge ved hurtig
   * tab-navigation).
   */
  inputElementRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;

  commitOnBlur?: boolean;
  commitOnEnter?: boolean;

  /**
   * UX-politik: når draften bliver tom, behandl det som "ingen valideringstilstand".
   */
  clearTouchedOnEmptyDraft?: boolean;
};

export type UseDraftFieldResult = {
  draft: string;
  setDraft: (nextDraft: string) => void;
  isFocused: boolean;

  /** "Er der forsøgt et commit?" (ikke "har brugeren interageret?"). */
  touched: boolean;

  /**
   * Display-klar parse-fejl for feltets aktuelle ikke-committbare tilstand. Er kun sat, når feltet
   * har en effektiv committed rå draft OG draften aktuelt viser den (dvs. ikke mens brugeren taster
   * en ny værdi). Beskeden gen-udledes ved at parse den rå draft (single source of truth: råstrengen).
   */
  error: DraftFieldError | undefined;

  onFocus: () => void;
  onBlur: (_e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

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
    onCommitInvalid,
    committedInvalidDraft,
    inputElementRef,
    commitOnBlur = true,
    commitOnEnter = true,
    clearTouchedOnEmptyDraft = false,
  } = config;

  // Lokal fallback for ubundne felter (uden `onCommitInvalid`-kanal): bevarer den ugyldige draft
  // efter blur, så den ikke silent-rolles tilbage. Bundne felter bruger `committedInvalidDraft`.
  const isBound = onCommitInvalid !== undefined;
  const [localInvalidDraft, setLocalInvalidDraft] = React.useState<string | null>(null);
  const effectiveInvalidDraft = isBound ? committedInvalidDraft : (localInvalidDraft ?? undefined);

  const formattedValue = format(value);
  const externalSource = effectiveInvalidDraft ?? formattedValue;

  const [isFocused, setIsFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(() => effectiveInvalidDraft !== undefined);
  const [draft, setDraftState] = React.useState<string>(externalSource);

  const isFocusedRef = React.useRef(isFocused);
  React.useLayoutEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Snapshot af draften ved fokus-start, så Escape gendanner præcis det brugeren begyndte at redigere.
  const focusSnapshotRef = React.useRef<string | null>(null);

  // Efter Escape-cancel eller Enter-commit kan en blur følge i samme interaktion. Suppression er
  // one-shot for det næste blur-commit.
  const suppressNextBlurCommitRef = React.useRef(false);

  // Post-commit-guard mod silent-rollback: efter et vellykket commit står draften optimistisk på den
  // committede repræsentation, mens `value`-proppen endnu ikke har indhentet (parent-rerender lagger).
  // Indtil `format(value)` faktisk ændrer sig fra værdien-ved-commit, må resync IKKE trække draften
  // tilbage til den stale committede værdi. (Bevarer den gamle pendingValueResync-determinisme.)
  const pendingCommitRef = React.useRef<{ formattedValueAtCommit: string; target: string } | null>(null);

  const hasPhysicalFocus = React.useCallback((): boolean => {
    const el = inputElementRef?.current ?? null;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return (
      el !== null &&
      active !== null &&
      (active === el || (el instanceof HTMLElement && active instanceof Node && el.contains(active)))
    );
  }, [inputElementRef]);

  // Autoritativ snapshot-epoch (bumpes ved load/reset/migration/undo-redo-restore). En ændring her er
  // et autoritativt replace-event, der pr. undo-redo-kontrakten aldrig sker midt i en åben editor —
  // derfor SKAL draften resyncs selv hvis feltet aktuelt har (read-only) DOM-fokus. Det erstatter det
  // tidligere eksplicitte draftHistoryRegistry-push, som overskrev fokus-guarden ved restore.
  const authoritativeEpoch = useAuthoritativeSnapshotEpochSelector();
  const lastAuthoritativeEpochRef = React.useRef(authoritativeEpoch);

  // Resync: når feltet ikke er aktivt redigeret, følger draften den eksterne kilde
  // (`committedInvalidDraft ?? format(value)`). Dette dækker committed value-ændringer, F5-rehydrering
  // og undo/redo-restore — alt sammen via den normale store→prop-vej, uden et separat draft-transportlag.
  React.useEffect(() => {
    const pending = pendingCommitRef.current;
    if (pending) {
      // Vent på at `value`-proppen indhenter commit'et før vi resyncer (undgå silent-rollback til stale værdi).
      if (formattedValue === pending.formattedValueAtCommit) return;
      pendingCommitRef.current = null;
    }
    const isAuthoritativeReplace = authoritativeEpoch !== lastAuthoritativeEpochRef.current;
    lastAuthoritativeEpochRef.current = authoritativeEpoch;
    if (!isAuthoritativeReplace && (isFocused || hasPhysicalFocus())) return;
    setDraftState((prev) => (prev === externalSource ? prev : externalSource));
  }, [authoritativeEpoch, externalSource, formattedValue, hasPhysicalFocus, isFocused]);

  // Fejlvisning afledes af råstrengen: kun når draften aktuelt VISER den effektive ugyldige draft
  // (ikke mens brugeren taster en ny værdi). Beskeden gen-udledes ved at parse den normaliserede råstreng.
  const error = React.useMemo<DraftFieldError | undefined>(() => {
    if (effectiveInvalidDraft === undefined) return undefined;
    if (draft !== effectiveInvalidDraft) return undefined;
    const normalized = (normalizeDraftOnCommit ?? defaultNormalizeDraftOnCommit)(effectiveInvalidDraft);
    const result = parse(normalized);
    if (result.ok) return undefined;
    if (result.kind === 'invalid') {
      return { kind: 'invalid', message: result.message, invalidDraft: effectiveInvalidDraft };
    }
    return { kind: result.kind, message: result.message, invalidDraft: effectiveInvalidDraft };
  }, [draft, effectiveInvalidDraft, normalizeDraftOnCommit, parse]);

  const setDraft = React.useCallback(
    (nextDraft: string) => {
      suppressNextBlurCommitRef.current = false;
      pendingCommitRef.current = null;
      setDraftState(nextDraft);
      if (clearTouchedOnEmptyDraft && nextDraft === '') {
        setTouched(false);
      }
    },
    [clearTouchedOnEmptyDraft]
  );

  const commitFromDraft = React.useCallback(
    (rawDraft: string) => {
      // Undertryk commit udløst af en undo/redo-fokus-flytning: når restore flytter fokus til mål-feltet,
      // blur'er det forrige felt SYNKRONT og ville her committe en forældet draft (fra før epoch-resync) →
      // det ville rydde den netop-gendannede invalidDraft og fange en spuriøs frame. Draften resyncs
      // korrekt af den autoritative epoch-effekt; her gør vi ingenting.
      if (isRestoreFocusInProgress()) return;
      setTouched(true);
      pendingCommitRef.current = null;
      const draftForCommit = (normalizeDraftOnCommit ?? defaultNormalizeDraftOnCommit)(rawDraft);
      const result = parse(draftForCommit);

      if (result.ok) {
        // Vellykket commit: ryd evt. lokal ugyldig draft og synk optimistisk til committed repræsentation.
        // Bundne felter rydder `invalidDrafts` via kalderens onCommit-wrapper (efter sektion-commit).
        if (!isBound) setLocalInvalidDraft(null);
        const target = format(result.value);
        pendingCommitRef.current = { formattedValueAtCommit: formattedValue, target };
        setDraftState(target);
        onCommit(result.value);
        return;
      }

      // Ikke-committbart: bevar committed værdi; persistér/bevar den RÅ draft (det brugeren ser),
      // så fejlvisningen (draft === effektiv ugyldig draft) holder, og restore gendanner det viste input.
      if (result.kind === 'invalid' || result.message !== undefined) {
        if (isBound) {
          onCommitInvalid?.(rawDraft);
        } else {
          setLocalInvalidDraft(rawDraft);
        }
        setDraftState(rawDraft);
        return;
      }

      // partial/empty uden besked: ingen fejl-tilstand, ingen commit (fx tom draft uden krav).
      if (!isBound) setLocalInvalidDraft(null);
    },
    [format, formattedValue, isBound, normalizeDraftOnCommit, onCommit, onCommitInvalid, parse]
  );

  const commit = React.useCallback(() => {
    commitFromDraft(draft);
  }, [commitFromDraft, draft]);

  const commitDraft = React.useCallback(
    (nextDraft: string) => {
      suppressNextBlurCommitRef.current = true;
      setDraftState(nextDraft);
      commitFromDraft(nextDraft);
    },
    [commitFromDraft]
  );

  const cancel = React.useCallback(() => {
    const snapshot = focusSnapshotRef.current;
    pendingCommitRef.current = null;
    setDraftState(snapshot ?? externalSource);
    suppressNextBlurCommitRef.current = true;
  }, [externalSource]);

  const shouldBubbleEnterForNavigation = React.useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return target.closest('[data-mineo-scroll-container="true"], table') !== null;
  }, []);

  const onFocus = React.useCallback(() => {
    setIsFocused(true);
    focusSnapshotRef.current = draft;
  }, [draft]);

  const onBlur = React.useCallback(
    (_e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsFocused(false);
      focusSnapshotRef.current = null;

      if (suppressNextBlurCommitRef.current) {
        suppressNextBlurCommitRef.current = false;
        return;
      }
      if (commitOnBlur) {
        commitFromDraft(draft);
      }
    },
    [commitFromDraft, commitOnBlur, draft]
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        suppressNextBlurCommitRef.current = true;
        cancel();
        return;
      }

      if (e.key === 'Enter' && commitOnEnter) {
        e.preventDefault();
        // Enter skal bubble for Container-/tabel-ejet traversal; uden for de kontekster håndtér lokalt.
        if (!shouldBubbleEnterForNavigation(e.target)) {
          e.stopPropagation();
        }
        suppressNextBlurCommitRef.current = true;
        commitFromDraft(draft);
      }
    },
    [cancel, commitFromDraft, commitOnEnter, draft, shouldBubbleEnterForNavigation]
  );

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

import * as React from 'react';
import type {
  DraftParse,
  DraftParseErrorKind,
} from '../types/fieldEvents';
import { useAuthoritativeSnapshotEpochSelector } from './useFormPersistenceSelectors';
import { isRestoreFocusInProgress } from '../utils/historyTargetRestore';
import { decideFieldResync } from './fieldState/fieldResyncMachine';
import { elementHasPhysicalFocus } from './fieldState/elementHasPhysicalFocus';
import { shouldDeriveInvalidDraftError } from './fieldState/shouldDeriveInvalidDraftError';
import { useInvalidDraftSlot } from './fieldState/useInvalidDraftSlot';

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
  onCommit: (nextValue: TModel) => boolean;

  /**
   * Kaldes ved fejlende (ikke-committbart) commit med den rå draft.
   *
   * Når sat (bundet felt) ejer kalderen persisteringen af den rå draft i `invalidDrafts` og leverer
   * den tilbage via `committedInvalidDraft`. Når den ikke er sat (ubundet felt, fx i settings),
   * holder hooken selv en lokal fallback, så den ugyldige draft ikke silent-rolles-tilbage ved blur.
   */
  onCommitInvalid?: (rawDraft: string) => boolean;

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

  commit: () => boolean;
  commitDraft: (nextDraft: string) => boolean;
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

  // Ugyldig-draft-slot (delt med useTableInputCore): bundet felt læser `committedInvalidDraft` fra
  // kanalen; ubundet felt (uden `onCommitInvalid`) holder en lokal fallback, så den ugyldige draft ikke
  // silent-rolles tilbage ved blur. Bundet rydning ejes bevidst af `onCommit`-wrapperen (`commitValue`)
  // hos kalderen — derfor gates den lokale slot-rydning her bag `!isBound`.
  const {
    bound: isBound,
    effectiveInvalidDraft,
    writeInvalidDraft,
    clearInvalidDraft: clearLocalInvalidDraft,
  } = useInvalidDraftSlot({
    bound: onCommitInvalid !== undefined,
    committedInvalidDraft,
    onCommitInvalid,
    clearInvalidDraft: undefined,
  });

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
  const pendingCommitRef = React.useRef<{ formattedValueAtCommit: string } | null>(null);

  const hasPhysicalFocus = React.useCallback(
    (): boolean => elementHasPhysicalFocus(inputElementRef?.current ?? null),
    [inputElementRef]
  );

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
    const command = decideFieldResync(
      {
        epochChanged: authoritativeEpoch !== lastAuthoritativeEpochRef.current,
        externalSource,
        currentFormattedValue: formattedValue,
        pending: pendingCommitRef.current,
        isActivelyEditing: isFocused || hasPhysicalFocus(),
      }
    );
    if (command.commitEpoch) lastAuthoritativeEpochRef.current = authoritativeEpoch;
    if (command.clearPending) pendingCommitRef.current = null;
    if (command.nextDraft !== null) {
      const next = command.nextDraft;
      setDraftState((prev) => (prev === next ? prev : next));
    }
  }, [authoritativeEpoch, externalSource, formattedValue, hasPhysicalFocus, isFocused]);

  // Fejlvisning afledes af råstrengen: kun når draften aktuelt VISER den effektive ugyldige draft
  // (ikke mens brugeren taster en ny værdi). Beskeden gen-udledes ved at parse den normaliserede råstreng.
  const error = React.useMemo<DraftFieldError | undefined>(() => {
    if (!shouldDeriveInvalidDraftError(effectiveInvalidDraft, draft)) return undefined;
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
    (rawDraft: string): boolean => {
      // Undertryk commit udløst af en undo/redo-fokus-flytning: når restore flytter fokus til mål-feltet,
      // blur'er det forrige felt SYNKRONT og ville her committe en forældet draft (fra før epoch-resync) →
      // det ville rydde den netop-gendannede invalidDraft og fange en spuriøs frame. Draften resyncs
      // korrekt af den autoritative epoch-effekt; her gør vi ingenting.
      if (isRestoreFocusInProgress()) return true;
      setTouched(true);
      pendingCommitRef.current = null;
      const draftForCommit = (normalizeDraftOnCommit ?? defaultNormalizeDraftOnCommit)(rawDraft);
      const result = parse(draftForCommit);

      if (result.ok) {
        // Vellykket commit: ryd evt. lokal ugyldig draft og synk optimistisk til committed repræsentation.
        // Bundne felter rydder `invalidDrafts` via kalderens onCommit-wrapper (efter sektion-commit).
        const target = format(result.value);
        try {
          const committed = onCommit(result.value);
          if (committed === false) {
            pendingCommitRef.current = null;
            setDraftState(externalSource);
            return false;
          }
        } catch {
          pendingCommitRef.current = null;
          setDraftState(externalSource);
          return false;
        }
        if (!isBound) clearLocalInvalidDraft();
        pendingCommitRef.current = target !== formattedValue ? { formattedValueAtCommit: formattedValue } : null;
        setDraftState(target);
        return true;
      }

      // Ikke-committbart: bevar committed værdi; persistér/bevar den RÅ draft (det brugeren ser),
      // så fejlvisningen (draft === effektiv ugyldig draft) holder, og restore gendanner det viste input.
      if (result.kind === 'invalid' || result.message !== undefined) {
        if (!writeInvalidDraft(rawDraft)) {
          setDraftState(externalSource);
          return false;
        }
        setDraftState(rawDraft);
        return false;
      }

      // partial/empty uden besked: ingen fejl-tilstand, ingen commit (fx tom draft uden krav).
      if (!isBound) clearLocalInvalidDraft();
      return true;
    },
    [clearLocalInvalidDraft, externalSource, format, formattedValue, isBound, normalizeDraftOnCommit, onCommit, parse, writeInvalidDraft]
  );

  const commit = React.useCallback((): boolean => {
    return commitFromDraft(draft);
  }, [commitFromDraft, draft]);

  const commitDraft = React.useCallback(
    (nextDraft: string) => {
      suppressNextBlurCommitRef.current = true;
      setDraftState(nextDraft);
      return commitFromDraft(nextDraft);
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

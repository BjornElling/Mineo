import * as React from 'react';
import type {
  DraftParse,
  DraftParseErrorKind,
} from '../types/fieldEvents';
import { useAuthoritativeSnapshotEpochSelector } from './useFormPersistenceSelectors';
import { isRestoreFocusInProgress } from '../utils/historyTargetRestore';
import type { FieldSettleParse } from './fieldState/fieldSettleMachine';
import { elementHasPhysicalFocus } from './fieldState/elementHasPhysicalFocus';
import { shouldDeriveInvalidDraftError } from './fieldState/shouldDeriveInvalidDraftError';
import { useInvalidDraftSlot } from './fieldState/useInvalidDraftSlot';
import { useDraftLifecycle } from './fieldState/useDraftLifecycle';

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
   * Bundet kanal-rydning af den committede rå draft (fra `invalidDrafts`-storen). Wires ind i den
   * delte slot, så hookens eksponerede `clearInvalidDraft` rydder DEN EFFEKTIVE tilstand — bundet
   * (store) eller ubundet (lokal fallback) — uden at kalderen skal kende bindingen. Spejler grid-
   * kernens (`useTableInputCore`) slot-opsætning, så form- og grid-stien ikke divergerer.
   */
  clearInvalidDraft?: () => boolean;

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

  /**
   * Feltets EFFEKTIVE ikke-committbare rå draft: den bundne kanalværdi (`committedInvalidDraft`) eller
   * den lokale fallback for ubundne felter. Kalderen (adapter/fri-tekst-felt) SKAL træffe sine
   * invalid-draft-beslutninger (shouldCommit, immediate-clear) på DENNE — ikke på den rå kanalværdi,
   * som er tom for ubundne felter og derfor giver blindhed over for den lokale draft.
   */
  effectiveInvalidDraft: string | undefined;

  /**
   * Unificeret rydning af den effektive ikke-committbare rå draft (bundet store ELLER lokal fallback).
   * Er den ENESTE rydningsvej kalderen behøver; erstatter direkte brug af den kun-bundne kanal-clear.
   */
  clearInvalidDraft: () => boolean;

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
    clearInvalidDraft: clearBoundInvalidDraft,
    inputElementRef,
    commitOnBlur = true,
    commitOnEnter = true,
    clearTouchedOnEmptyDraft = false,
  } = config;

  // Ugyldig-draft-slot (delt med useTableInputCore): bundet felt læser/rydder via kanalen; ubundet felt
  // (uden `onCommitInvalid`) holder en lokal fallback, så den ugyldige draft ikke silent-rolles tilbage
  // ved blur. Kanal-rydningen wires ind i slotten (som i grid-kernen), så `clearInvalidDraftSlot` rydder
  // den EFFEKTIVE tilstand uanset binding — hookens eneste rydningsvej. På den succesfulde commit-sti
  // gates den stadig bag `!isBound`, fordi den bundne rydning dér ejes af kalderens `onCommit`-wrapper
  // (`commitValue`), der rydder efter sektion-commit (bevarer commit-rækkefølgen: værdi FØRST, så clear).
  const {
    bound: isBound,
    effectiveInvalidDraft,
    writeInvalidDraft,
    clearInvalidDraft: clearInvalidDraftSlot,
  } = useInvalidDraftSlot({
    bound: onCommitInvalid !== undefined,
    committedInvalidDraft,
    onCommitInvalid,
    clearInvalidDraft: clearBoundInvalidDraft,
  });

  const formattedValue = format(value);
  const externalSource = effectiveInvalidDraft ?? formattedValue;

  const [isFocused, setIsFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(() => effectiveInvalidDraft !== undefined);

  const isFocusedRef = React.useRef(isFocused);
  React.useLayoutEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Snapshot af draften ved fokus-start, så Escape gendanner præcis det brugeren begyndte at redigere.
  const focusSnapshotRef = React.useRef<string | null>(null);

  // Efter Escape-cancel eller Enter-commit kan en blur følge i samme interaktion. Suppression er
  // one-shot for det næste blur-commit.
  const suppressNextBlurCommitRef = React.useRef(false);

  const hasPhysicalFocus = React.useCallback(
    (): boolean => elementHasPhysicalFocus(inputElementRef?.current ?? null),
    [inputElementRef]
  );

  // Autoritativ snapshot-epoch (bumpes ved load/reset/migration/undo-redo-restore). En ændring her er
  // et autoritativt replace-event, der pr. undo-redo-kontrakten aldrig sker midt i en åben editor —
  // derfor SKAL draften resyncs selv hvis feltet aktuelt har (read-only) DOM-fokus. Det erstatter det
  // tidligere eksplicitte draftHistoryRegistry-push, som overskrev fokus-guarden ved restore.
  const authoritativeEpoch = useAuthoritativeSnapshotEpochSelector();
  const isActivelyEditing = React.useCallback(
    () => isFocusedRef.current || hasPhysicalFocus(),
    [hasPhysicalFocus]
  );
  // Form-stiens resync rørte ALDRIG `touched` (heller ikke ved autoritativt replace) — bevaret som no-op,
  // så load/reset/undo-redo ikke ændrer feltets touched-tilstand. (Grid'en har sin egen touched-/keyInitiated-
  // reset ved replace; det er en bevidst surface-divergens.)
  const onAuthoritativeReplace = React.useCallback(() => {}, []);

  // Delt draft-livscyklus (draft-state + eager ref, pending-commit-guard og epoch-resync). Erstatter
  // den tidligere hånd-duplikerede resync-effekt + pendingCommitRef, som `useTableInputCore` spejlede.
  const {
    draft,
    setDraft: setLifecycleDraft,
    pendingRef: pendingCommitRef,
    executeSettle,
  } = useDraftLifecycle<TModel>({
    initialDraft: externalSource,
    authoritativeEpoch,
    externalSource,
    currentFormattedValue: formattedValue,
    isActivelyEditing,
    // Form-resyncens gamle dep-array indeholdt `isFocused` — før den ind, så et fokus-skift re-kører resync.
    resyncDeps: [isFocused],
    onAuthoritativeReplace,
  });

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
      setLifecycleDraft(nextDraft);
      if (clearTouchedOnEmptyDraft && nextDraft === '') {
        setTouched(false);
      }
    },
    [clearTouchedOnEmptyDraft, pendingCommitRef, setLifecycleDraft]
  );

  const commitFromDraft = React.useCallback(
    (rawDraft: string): boolean => {
      // Undertryk commit udløst af en undo/redo-fokus-flytning: når restore flytter fokus til mål-feltet,
      // blur'er det forrige felt SYNKRONT og ville her committe en forældet draft (fra før epoch-resync) →
      // det ville rydde den netop-gendannede invalidDraft og fange en spuriøs frame. Draften resyncs
      // korrekt af den autoritative epoch-effekt; her gør vi ingenting.
      if (isRestoreFocusInProgress()) return true;
      setTouched(true);
      const draftForCommit = (normalizeDraftOnCommit ?? defaultNormalizeDraftOnCommit)(rawDraft);
      const result = parse(draftForCommit);

      // Klassificér parse-udfaldet til den delte settle-kerne. Form-stien har intet fingerprint-no-op-
      // begreb (isNoop: false); dens pending-guard afgøres alene af target vs formattedValue, som kernen
      // udleder. En ikke-committbar råstreng med fejlsemantik (invalid, eller partial/empty med besked)
      // bevares som ugyldig draft; en partial/empty uden besked er inert.
      const settleParse: FieldSettleParse<TModel> = result.ok
        ? { status: 'valid', value: result.value }
        : result.kind === 'invalid' || result.message !== undefined
          ? { status: 'invalid' }
          : { status: 'inert' };

      // Den delte livscyklus kører settle-kernen og ejer pending-guard + rollback. Form-grenene:
      //  - commit: `onCommit`-wrapper (bundne felter rydder invalidDrafts der; ubundne rydder slotten),
      //  - inert: ryd kun den ubundne slot (bundet clear ejes af onCommit-wrapperen),
      //  - invalid: skriv den rå draft til slotten.
      return executeSettle(rawDraft, {
        parse: settleParse,
        isNoop: false,
        formattedValueAtCommit: formattedValue,
        target: result.ok ? format(result.value) : formattedValue,
      }, {
        writeInvalidDraft,
        commitValue: onCommit,
        // Efter en vellykket reel commit: ryd den ubundne slot (bundet clear ejes af kalderens
        // onCommit-wrapper). Slot-clearens resultat ignoreres bevidst — som i den tidligere form-sti.
        afterValueCommit: () => {
          if (!isBound) clearInvalidDraftSlot();
          return true;
        },
        onInert: () => {
          if (!isBound) clearInvalidDraftSlot();
          return true;
        },
        onNoopCommit: () => {
          if (!isBound) clearInvalidDraftSlot();
          return true;
        },
      });
    },
    [clearInvalidDraftSlot, executeSettle, format, formattedValue, isBound, normalizeDraftOnCommit, onCommit, parse, writeInvalidDraft]
  );

  const commit = React.useCallback((): boolean => {
    return commitFromDraft(draft);
  }, [commitFromDraft, draft]);

  const commitDraft = React.useCallback(
    (nextDraft: string) => {
      suppressNextBlurCommitRef.current = true;
      setLifecycleDraft(nextDraft);
      return commitFromDraft(nextDraft);
    },
    [commitFromDraft, setLifecycleDraft]
  );

  const cancel = React.useCallback(() => {
    const snapshot = focusSnapshotRef.current;
    pendingCommitRef.current = null;
    setLifecycleDraft(snapshot ?? externalSource);
    suppressNextBlurCommitRef.current = true;
  }, [externalSource, pendingCommitRef, setLifecycleDraft]);

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
    effectiveInvalidDraft,
    clearInvalidDraft: clearInvalidDraftSlot,
    onFocus,
    onBlur,
    onKeyDown,
    commit,
    commitDraft,
    cancel,
  };
};

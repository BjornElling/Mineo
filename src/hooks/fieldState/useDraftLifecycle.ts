import * as React from 'react';
import {
  decideFieldResync,
  type FieldResyncFacts,
} from './fieldResyncMachine';
import {
  decideFieldSettle,
  type FieldSettleFacts,
  type FieldSettleParse,
} from './fieldSettleMachine';

/**
 * Delt React-tynd draft-livscyklus for `useDraftField` (form-`<input>`) og `useTableInputCore`
 * (grid-celle-editor). Hook'en ejer den identiske, delikate lim, de to surfaces tidligere
 * implementerede hver for sig med kryds-refererende kommentarer:
 *
 *  - `draft`-state PLUS en eager `draftRef` (grid'en læser den synkront i sine event-handlers),
 *  - den optimistiske commit-guard (`pendingCommitRef`), der beskytter mod silent-rollback/flicker,
 *    mens `value`-proppen indhenter efter et commit,
 *  - den autoritative-epoch-resync-effekt (load/reset/migration/undo-redo-restore), der driver
 *    {@link decideFieldResync} og anvender den returnerede {@link import('./fieldResyncMachine').FieldResyncCommand},
 *  - settle-eksekveringen omkring {@link decideFieldSettle}: den kalder de surface-ejede effekter
 *    (skriv-rejected / value-commit / clear / draft-sync) i den rigtige rækkefølge og sætter/rydder
 *    pending-guarden.
 *
 * Surface-forskellene udtrykkes som *seams* (callbacks) — ikke som forgrenet logik her: hvordan den
 * eksterne kilde/formatterede værdi udledes, om feltet aktivt redigeres, hvad et autoritativt replace
 * (og et nyt eksternt rejected input) medfører af touched-/keyInitiated-side-effekter, og selve
 * write/commit/clear-effekterne. Al rå→canonical-parsing forbliver i codec/adapter.
 */

export type DraftLifecyclePending = Readonly<{ formattedValueAtCommit: string }>;

/**
 * Surface-ejede effekter, settle-eksekveringen kalder. Rækkefølge og rollback ejes af denne hook;
 * effekterne udfører den konkrete surface-mutation og signalerer succes/fejl via returværdien.
 */
export type DraftSettleEffects<TValue> = Readonly<{
  /**
   * Skriv den ikke-committbare rå draft til den effektive ugyldig-draft-slot. Returnér `false`,
   * hvis skrivningen fejlede (så draften rulles tilbage til den eksterne kilde).
   */
  writeInvalidDraft: (raw: string) => boolean;
  /**
   * Committ den canonical værdi (form: `onCommit`-wrapper; grid: value-`onBlur` + evt. staged clear).
   * Returnér `false`, hvis committen ikke lykkedes (draften rulles tilbage).
   */
  commitValue: (value: TValue) => boolean;
  /**
   * Ryd den effektive ugyldig-draft-slot (bruges i `inert`- og `noop`-grenene). Returnér `false` ved
   * fejl. Kan udelades, hvor grenen ikke skal røre slotten (form-stien ejer bundet clear i `commitValue`).
   */
  clearInvalidDraft?: () => boolean;
  /**
   * Kaldes i `inert`-grenen (form: tom/partial uden besked). Grid'en har ingen inert-gren og udelader den.
   * Returnér resultatet af en evt. clear, som grenen skal viderebringe.
   */
  onInert?: () => boolean;
  /**
   * Kaldes i `noop`-grenen (grid: fingerprint-match, uændret canonical værdi). Form-stien har intet
   * selvstændigt no-op-begreb og udelader den. Returnér resultatet grenen skal viderebringe.
   */
  onNoopCommit?: () => boolean;
  /**
   * Kaldes lige før en reel (ikke-noop) value-commit, så grid'en kan sætte den optimistiske draft +
   * evt. visual-fejl-state, før `commitValue` køres. Form-stien udelader den.
   */
  beforeValueCommit?: (target: string) => void;
  /**
   * Kaldes efter en vellykket reel value-commit. Form-stien rydder her den ubundne slot (den bundne
   * clear ejes af dens `commitValue`-wrapper); grid'en udelader den (den staged sin clear i `commitValue`).
   * Returnér `false` for at signalere at efter-committ-oprydningen fejlede (draften rulles tilbage).
   */
  afterValueCommit?: () => boolean;
}>;

export type UseDraftLifecycleConfig = Readonly<{
  /** Startværdi for draften (typisk `effectiveInvalidDraft ?? format(value)` ved mount). */
  initialDraft: string;
  /** Den aktuelle autoritative snapshot-epoch (bumpes ved load/reset/migration/undo-redo-restore). */
  authoritativeEpoch: number;
  /** Den eksterne kilde draften skal følge når feltet ikke redigeres: `committedInvalidDraft ?? format(value)`. */
  externalSource: string;
  /** `format(value)` — sammenlignes mod pending-guardens fangede værdi. */
  currentFormattedValue: string;
  /**
   * Sandt når feltet aktivt redigeres (form: fokus; grid: `isEditing`/fysisk fokus/afventende draft).
   * Kaldes som funktion INDE i resync-effekten, så den fysiske DOM-fokus-check evalueres på effekt-tidspunktet
   * (Reacts fokus-state kan lagge bag `document.activeElement`). Fordi den er en callback, indgår den ikke selv
   * i effektens dep-array; surfacen SKAL derfor føre de redigerings-tilstande, der påvirker svaret
   * (fx `isFocused`/`isEditing`), ind via {@link resyncDeps}, ellers re-kører resync ikke ved et tilstandsskift.
   */
  isActivelyEditing: () => boolean;
  /**
   * Ekstra render-tilstande, hvis ændring skal udløse en resync-genkørsel ud over `authoritativeEpoch`,
   * `externalSource` og `currentFormattedValue`. Form fører `isFocused`; grid fører `isEditing` og
   * `effectiveInvalidDraft` — præcis de deps de tidligere separate resync-effekter havde. Uden dem ville en
   * indsnævret dep-array misse gennemløb, de gamle effekter kørte (fx editor-luk uden ekstern kildeændring).
   */
  resyncDeps?: readonly unknown[];
  /** Autoritativt replace (load/reset/undo-redo) — surface nulstiller touched/keyInitiated her. */
  onAuthoritativeReplace: () => void;
  /** Et nyt eksternt rejected input dukkede op via store (fx sideløbende commit) — surface viser fejlen. */
  onExternalInvalidDraftAppeared?: () => void;
  /**
   * Draften settle-eksekveringen ruller tilbage til, når en effekt fejler. Default: `externalSource`
   * (form). Grid'en sætter den til den rene committede visning, så en fejlet reel commit ikke afdækker
   * en tilbageværende rå draft — samme divergens som før konsolideringen.
   */
  rollbackDraft?: string;
}>;

export type UseDraftLifecycleResult<TValue> = Readonly<{
  draft: string;
  /** Eager ref, der altid afspejler den senest satte draft (også synkront inden næste render). */
  draftRef: React.RefObject<string>;
  /** Sæt draften OG opdatér `draftRef` synkront; rydder ikke pending-guarden. */
  setDraft: (next: string) => void;
  /** Er der en optimistisk commit-guard aktiv? (surface bruger den til sin resync-fakta.) */
  pendingRef: React.RefObject<DraftLifecyclePending | null>;
  /** Ryd pending-guarden (fx ved draft-ændring / paste, hvor et nyt input annullerer den). */
  clearPending: () => void;
  /**
   * Eksekvér settle af en allerede parset råstreng. Kører {@link decideFieldSettle} og udfører de
   * surface-ejede effekter i korrekt rækkefølge med pending-guard og rollback. Returnerer `true`, når
   * feltet blev committet/inert/noop uden fejl, og `false`, når resultatet var ikke-committbart eller
   * en effekt fejlede.
   */
  executeSettle: (raw: string, facts: Readonly<{
    parse: FieldSettleParse<TValue>;
    isNoop: boolean;
    formattedValueAtCommit: string;
    target: string;
  }>, effects: DraftSettleEffects<TValue>) => boolean;
}>;

export const useDraftLifecycle = <TValue>(
  config: UseDraftLifecycleConfig
): UseDraftLifecycleResult<TValue> => {
  const {
    initialDraft,
    authoritativeEpoch,
    externalSource,
    currentFormattedValue,
    isActivelyEditing,
    resyncDeps,
    onAuthoritativeReplace,
    onExternalInvalidDraftAppeared,
    rollbackDraft,
  } = config;

  const [draft, setDraftState] = React.useState<string>(initialDraft);
  const draftRef = React.useRef<string>(draft);
  const pendingRef = React.useRef<DraftLifecyclePending | null>(null);
  const lastAuthoritativeEpochRef = React.useRef(authoritativeEpoch);

  const effectiveRollbackDraft = rollbackDraft ?? externalSource;

  // Hold surface-callbacks + rollback-mål i en ref, så resync-effekten og `executeSettle` ikke re-kører
  // /skifter identitet alene fordi en inline-closure fik ny reference pr. render (surfaces sender typisk
  // friske funktioner hvert render).
  const latest = React.useRef({ isActivelyEditing, onAuthoritativeReplace, onExternalInvalidDraftAppeared, rollbackDraft: effectiveRollbackDraft });
  React.useLayoutEffect(() => {
    latest.current = { isActivelyEditing, onAuthoritativeReplace, onExternalInvalidDraftAppeared, rollbackDraft: effectiveRollbackDraft };
  }, [isActivelyEditing, onAuthoritativeReplace, onExternalInvalidDraftAppeared, effectiveRollbackDraft]);

  const setDraft = React.useCallback((next: string) => {
    draftRef.current = next;
    setDraftState((prev) => (prev === next ? prev : next));
  }, []);

  const clearPending = React.useCallback(() => {
    pendingRef.current = null;
  }, []);

  // Resync: når feltet ikke aktivt redigeres, følger draften den eksterne kilde. Autoritative replace-
  // events (epoch-bump) vinder altid, også over fokus og pending-guard, jf. fieldResyncMachine.
  React.useEffect(() => {
    const facts: FieldResyncFacts = {
      epochChanged: authoritativeEpoch !== lastAuthoritativeEpochRef.current,
      externalSource,
      currentFormattedValue,
      pending: pendingRef.current,
      isActivelyEditing: latest.current.isActivelyEditing(),
    };
    const command = decideFieldResync(facts);
    if (command.commitEpoch) lastAuthoritativeEpochRef.current = authoritativeEpoch;
    if (command.clearPending) pendingRef.current = null;
    if (command.nextDraft !== null) {
      const next = command.nextDraft;
      draftRef.current = next;
      setDraftState((prev) => (prev === next ? prev : next));
      if (command.isAuthoritativeReplace) {
        latest.current.onAuthoritativeReplace();
      } else {
        latest.current.onExternalInvalidDraftAppeared?.();
      }
    }
    // resyncDeps fører surfacens redigerings-tilstande (form: isFocused; grid: isEditing +
    // effectiveInvalidDraft) ind, så effekten re-kører præcis når de tidligere separate effekter gjorde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoritativeEpoch, externalSource, currentFormattedValue, ...(resyncDeps ?? [])]);

  const executeSettle = React.useCallback<UseDraftLifecycleResult<TValue>['executeSettle']>(
    (raw, facts, effects) => {
      const rollback = latest.current.rollbackDraft;
      // Nulstil pending-guarden ubetinget ved ethvert settle-forsøg — som begge de tidligere
      // `commitFromDraft`/`commitAndEmitBlur` gjorde i toppen. Den reelle commit-gren re-sætter den
      // efterfølgende til `command.pending`. Uden dette ville en inert- eller invalid-settle efter et
      // tidligere reelt commit efterlade en stale guard, der undertrykker en efterfølgende resync.
      pendingRef.current = null;
      const settleFacts: FieldSettleFacts<TValue> = {
        parse: facts.parse,
        isNoop: facts.isNoop,
        formattedValueAtCommit: facts.formattedValueAtCommit,
        target: facts.target,
      };
      const command = decideFieldSettle(raw, settleFacts);

      if (command.kind === 'invalid') {
        // Ikke-committbart: bevar committed værdi; persistér/bevar den RÅ draft, så fejlvisningen holder
        // (draft === effektiv ugyldig draft), og restore gendanner det viste input.
        if (!effects.writeInvalidDraft(command.raw)) {
          setDraft(rollback);
          return false;
        }
        setDraft(command.raw);
        return false;
      }

      if (command.kind === 'inert') {
        // Tom/partial uden besked: ingen commit, ingen rejection. Slot-clear ejes af surface-grenen.
        return effects.onInert?.() ?? effects.clearInvalidDraft?.() ?? true;
      }

      // commit
      if (command.noop) {
        // Uændret canonical værdi → intet value-commit. Ryd alligevel en evt. tilbageværende rå draft.
        return effects.onNoopCommit?.() ?? effects.clearInvalidDraft?.() ?? true;
      }

      // Reel value-commit: kør surface-forberedelsen (fx grid'ens visual-fejl-state), dernæst
      // value-commit-effekten, og synk til sidst draften optimistisk til den committede repræsentation
      // med pending-guarden sat — så en langsom prop-indhentning ikke flimrer draften tilbage.
      effects.beforeValueCommit?.(command.target);
      try {
        if (!effects.commitValue(command.value)) {
          pendingRef.current = null;
          setDraft(rollback);
          return false;
        }
        if (effects.afterValueCommit?.() === false) {
          pendingRef.current = null;
          setDraft(rollback);
          return false;
        }
      } catch {
        pendingRef.current = null;
        setDraft(rollback);
        return false;
      }
      pendingRef.current = command.pending;
      setDraft(command.target);
      return true;
    },
    [setDraft]
  );

  return {
    draft,
    draftRef,
    setDraft,
    pendingRef,
    clearPending,
    executeSettle,
  };
};

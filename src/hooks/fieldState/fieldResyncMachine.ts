/**
 * Ren, React-uafhængig beslutningskerne for felt-draft-resync — det delte hjerte af
 * `useDraftField` (form-`<input>`-surface) og `useTableInputCore` (grid-celle-editor-surface).
 *
 * Begge hooks implementerede tidligere den *samme* resync-invariant hver for sig, med kommentarer der
 * åbent kryds-refererede hinanden ("spejler useDraftField"). Denne funktion samler invarianten ét sted;
 * de to hooks driver den med deres egne surface-fakta og udfører de deklarative effekter (`setDraft`,
 * ryd pending, opdatér epoch-ref, touched-side-effekter).
 *
 * ## Invarianten
 * Når feltet ikke aktivt redigeres, følger draften den eksterne kilde (`committedInvalidDraft ??
 * format(value)`). To værn beskytter mod at trække draften væk under brugerens fingre:
 *
 *  1. **Aktiv-redigering-guard.** Mens feltet redigeres (React-fokus / fysisk DOM-fokus / åben
 *     grid-editor / afventende draft-commit) resyncer vi IKKE — MEDMINDRE det er et *autoritativt
 *     replace* (load/reset/migration/undo-redo-restore, signaleret via en epoch-bump), der pr.
 *     undo/redo-kontrakten aldrig sker midt i en åben editor og derfor altid vinder.
 *  2. **Optimistisk-commit-guard (`pending`).** Efter et vellykket commit står draften optimistisk på
 *     den committede repræsentation, mens `value`-proppen endnu ikke har indhentet (parent-rerender
 *     lagger). Indtil `format(value)` faktisk divergerer fra værdien-ved-commit, må resync ikke trække
 *     draften tilbage til den stale committede værdi (silent-rollback/flicker).
 *
 * ## Klassificeret surface-divergens (jf. greenfield #25, brugerens reservation)
 * Præcis ét punkt afviger reelt mellem de to surfaces: **hvilket værn der er yderst — pending-guarden
 * eller epoch-checket** (`pendingHoldOutranksEpoch`).
 *
 *  - **Form (`useDraftField`)**: pending-guarden er yderst. Et pending-*hold* (proppen har endnu ikke
 *    indhentet) returnerer FØR epoch-checket og opdaterer ikke epoch-ref'en — et autoritativt replace,
 *    der rammer i pending-vinduet, udskydes derved ét render til proppen har indhentet.
 *  - **Grid (`useTableInputCore`)**: epoch-checket er yderst. Et autoritativt replace rydder pending og
 *    resyncer straks, også midt i pending-vinduet.
 *
 * Divergensen er kun observerbar i et i praksis uopnåeligt kapløb (commit, dernæst undo-til-præcis-
 * pre-commit-værdi, ankommet før `value`-proppen har sat sig). Den er derfor **bevaret verbatim**
 * (bucket 3: uafklaret — ikke konverteret i dette trin) og eksponeret som en eksplicit, navngiven
 * policy frem for et skjult `isGrid`-flag. Kandidat til bevidst konvergens i et senere trin.
 */

export type FieldResyncPending = Readonly<{
  /** `format(value)` fanget ved commit-tidspunktet — sammenlignes for at afgøre om proppen har indhentet. */
  formattedValueAtCommit: string;
}>;

export type FieldResyncFacts = Readonly<{
  /** `authoritativeEpoch !== sidst observerede epoch` (load/reset/migration/undo-redo-restore). */
  epochChanged: boolean;
  /** Den eksterne kilde draften skal følge: `committedInvalidDraft ?? format(value)`. */
  externalSource: string;
  /** `format(value)` — sammenlignes mod `pending.formattedValueAtCommit`. */
  currentFormattedValue: string;
  /** Optimistisk-commit-guarden, eller `null` når intet commit afventer prop-indhentning. */
  pending: FieldResyncPending | null;
  /**
   * Sandt når feltet aktivt redigeres. Form: `isFocused || hasPhysicalFocus()`. Grid:
   * `isEditing || hasPhysicalFocus() || pendingDraftCommit`.
   */
  isActivelyEditing: boolean;
}>;

export type FieldResyncPolicy = Readonly<{
  /** Se modul-doc'en: form = `true` (pending yderst), grid = `false` (epoch yderst). */
  pendingHoldOutranksEpoch: boolean;
}>;

export type FieldResyncCommand = Readonly<{
  /** Draften skal sættes til denne værdi; `null` = lad draften være urørt. */
  nextDraft: string | null;
  /** `pendingCommit`-guarden skal ryddes (sæt ref til `null`). */
  clearPending: boolean;
  /** Den observerede epoch skal skrives til "sidst observerede"-ref'en. */
  commitEpoch: boolean;
  /** Autoritativt replace — kalderen kører sine egne side-effekter (touched/keyInitiated-reset). */
  isAuthoritativeReplace: boolean;
}>;

const HOLD: Omit<FieldResyncCommand, 'commitEpoch'> = {
  nextDraft: null,
  clearPending: false,
  isAuthoritativeReplace: false,
};

const isPendingHold = (facts: FieldResyncFacts): boolean =>
  facts.pending !== null && facts.currentFormattedValue === facts.pending.formattedValueAtCommit;

/**
 * Afgør resync-handlingen for ét effekt-gennemløb. Ren funktion: ingen refs, ingen React, ingen
 * side-effekter — kalderen udfører det returnerede {@link FieldResyncCommand}.
 */
export const decideFieldResync = (facts: FieldResyncFacts, policy: FieldResyncPolicy): FieldResyncCommand => {
  const pendingExisted = facts.pending !== null;

  if (policy.pendingHoldOutranksEpoch) {
    // Form-ordering: pending-guarden er yderst (også over epoch).
    if (isPendingHold(facts)) {
      // Hold: proppen har endnu ikke indhentet commit'et. Epoch-ref'en opdateres IKKE (udskyd
      // autoritativ-replace-detektionen til proppen har sat sig).
      return { ...HOLD, commitEpoch: false };
    }
    if (facts.epochChanged) {
      return { nextDraft: facts.externalSource, clearPending: pendingExisted, commitEpoch: true, isAuthoritativeReplace: true };
    }
    if (facts.isActivelyEditing) {
      return { nextDraft: null, clearPending: pendingExisted, commitEpoch: true, isAuthoritativeReplace: false };
    }
    return { nextDraft: facts.externalSource, clearPending: pendingExisted, commitEpoch: true, isAuthoritativeReplace: false };
  }

  // Grid-ordering: epoch-checket er yderst.
  if (facts.epochChanged) {
    return { nextDraft: facts.externalSource, clearPending: pendingExisted, commitEpoch: true, isAuthoritativeReplace: true };
  }
  if (isPendingHold(facts)) {
    return { nextDraft: null, clearPending: false, commitEpoch: true, isAuthoritativeReplace: false };
  }
  if (facts.isActivelyEditing) {
    return { nextDraft: null, clearPending: pendingExisted, commitEpoch: true, isAuthoritativeReplace: false };
  }
  return { nextDraft: facts.externalSource, clearPending: pendingExisted, commitEpoch: true, isAuthoritativeReplace: false };
};

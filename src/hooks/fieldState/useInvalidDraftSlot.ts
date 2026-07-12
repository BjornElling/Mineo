import * as React from 'react';

/**
 * Delt "ugyldig-draft-slot" for `useDraftField` (form) og `useTableInputCore` (grid).
 *
 * Begge surfaces har præcis det samme forgrenings-mønster for hvor en ikke-committbar rå draft bor:
 *  - **Bundet**: en `invalidDrafts`-kanal (persisteret i store'en, driver save-gating + undo/redo).
 *    `committedInvalidDraft` er den autoritative værdi; skriv/ryd går til kanalen.
 *  - **Ubundet** (ingen provider/scope, fx isolerede tests, eller adaptere uden save-error): en lokal
 *    fallback-state, så en ugyldig draft ikke silent-rolles tilbage ved blur.
 *
 * Slotten ejer fallback-state'n, `effectiveInvalidDraft`-udledningen og write/clear-dispatchet. De to
 * kanal-hooks (`useFieldInvalidDraftChannel` / `useCellInvalidDraftChannel`) leverer allerede den samme
 * `{ committedInvalidDraft, onCommitInvalid, clearInvalidDraft }`-triple; her samles forgreningen.
 *
 * Bevidst surface-forskel (bevaret): form-stien rydder KUN slotten internt i den ubundne gren og
 * overlader den bundne rydning til sin `onCommit`-wrapper (`commitValue`), mens grid-stien selv rydder
 * den bundne kanal. Kalderen styrer det ved at gate `clearInvalidDraft` bag `bound` efter behov.
 */
export type InvalidDraftChannel = Readonly<{
  /** Sandt når kanalen er bundet (provider + scope til stede og aktiveret). */
  bound: boolean;
  committedInvalidDraft: string | undefined;
  onCommitInvalid: ((rawDraft: string) => boolean) | undefined;
  clearInvalidDraft: (() => boolean) | undefined;
}>;

export type InvalidDraftSlot = Readonly<{
  /** `true` når kanalen er bundet (læs den autoritative værdi fra store'en). */
  bound: boolean;
  /** Den effektive ugyldige draft: kanalens committede værdi (bundet) eller den lokale fallback. */
  effectiveInvalidDraft: string | undefined;
  /** Skriv en ikke-committbar rå draft (dispatcher til kanal eller lokal fallback). */
  writeInvalidDraft: (rawDraft: string) => boolean;
  /** Ryd den ugyldige draft (dispatcher til kanal eller lokal fallback). */
  clearInvalidDraft: () => boolean;
}>;

export const useInvalidDraftSlot = (channel: InvalidDraftChannel): InvalidDraftSlot => {
  const { bound, committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = channel;

  const [localInvalidDraft, setLocalInvalidDraft] = React.useState<string | null>(null);
  const effectiveInvalidDraft = bound ? committedInvalidDraft : localInvalidDraft ?? undefined;

  const writeInvalidDraft = React.useCallback(
    (rawDraft: string) => {
      if (bound) return onCommitInvalid?.(rawDraft) ?? false;
      setLocalInvalidDraft(rawDraft);
      return true;
    },
    [bound, onCommitInvalid]
  );

  const clear = React.useCallback(() => {
    if (bound) return clearInvalidDraft?.() ?? false;
    setLocalInvalidDraft(null);
    return true;
  }, [bound, clearInvalidDraft]);

  return { bound, effectiveInvalidDraft, writeInvalidDraft, clearInvalidDraft: clear };
};

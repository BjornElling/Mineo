import * as React from 'react';

// Transient (ikke-persisteret) inputtilstand. Til de FÅ flader, hvor et input IKKE er sagsdata og derfor
// ikke hører i den autoritative inputtilstand (§3.1): et overlay/dialog-scratchfelt, hvis værdi kun lever i
// komponentens egen state.
//
// Bevidst adskilt fra greenfield-feltvejen: her er ingen feltadresse, intet issue-snapshot, ingen
// `rejectedInputs`, ingen history og ingen persistens. Til gengæld bevares den Mineo-velkendte
// blur-/Enter-commit-mekanik, så et transient felt føles som et rigtigt felt.
//
// Der findes ÉN sådan kerne (denne), så de transiente felter ikke kan drifte fra hinanden.

export type TransientDraftParse<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; message?: string }>;

export type UseTransientDraftConfig<T> = Readonly<{
  /** Den aktuelle committede værdi (kalderens egen state). */
  value: T;
  /** Kanonisk visning af den committede værdi. Skal være stabil for ækvivalente værdier. */
  format: (value: T) => string;
  /** Parser en rå draft til en værdi, eller afviser den med en besked. */
  parse: (draft: string) => TransientDraftParse<T>;
  /** Kaldes ved et gyldigt commit. */
  onCommit: (next: T) => void;
  /** Kaldes når draften afvises ved commit (fx til at vise en lokal fejl). */
  onReject?: (draft: string, message: string | undefined) => void;
}>;

export type TransientDraftState = Readonly<{
  draft: string;
  onDraftChange: (next: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Committer draften nu (til eksplicitte handlinger, fx en Beregn-knap i samme dialog). */
  commit: () => void;
}>;

/**
 * Draft/commit-mekanik for et transient felt: draften ejes lokalt, committer på blur og Enter, og
 * Escape fortryder tilbage til den værdi, redigeringen startede fra. Mens feltet er fokuseret,
 * overskrives draften ikke af en ny `value` — ellers ville brugerens indtastning kunne blive
 * trukket væk under fingrene.
 */
export const useTransientDraft = <T>(config: UseTransientDraftConfig<T>): TransientDraftState => {
  const { value, format, parse, onCommit, onReject } = config;

  const formatted = format(value);
  const [draft, setDraft] = React.useState(formatted);
  const [isFocused, setIsFocused] = React.useState(false);
  const focusSnapshotRef = React.useRef<string | null>(null);
  const suppressNextBlurCommitRef = React.useRef(false);

  // Resync fra den committede værdi, men ALDRIG mens brugeren redigerer.
  const lastFormattedRef = React.useRef(formatted);
  if (!isFocused && formatted !== lastFormattedRef.current) {
    lastFormattedRef.current = formatted;
    if (draft !== formatted) setDraft(formatted);
  }

  const latest = React.useRef({ draft, formatted, parse, onCommit, onReject });
  latest.current = { draft, formatted, parse, onCommit, onReject };

  const commitDraft = React.useCallback((raw: string) => {
    const { parse: doParse, onCommit: doCommit, onReject: doReject, formatted: current } = latest.current;
    if (raw === current) return;
    const result = doParse(raw);
    if (result.ok) {
      doCommit(result.value);
      return;
    }
    doReject?.(raw, result.message);
  }, []);

  const onDraftChange = React.useCallback((next: string) => {
    suppressNextBlurCommitRef.current = false;
    setDraft(next);
  }, []);

  const onFocus = React.useCallback(() => {
    setIsFocused(true);
    focusSnapshotRef.current = latest.current.draft;
  }, []);

  const onBlur = React.useCallback(() => {
    setIsFocused(false);
    focusSnapshotRef.current = null;
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    commitDraft(latest.current.draft);
  }, [commitDraft]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        suppressNextBlurCommitRef.current = true;
        commitDraft(latest.current.draft);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        suppressNextBlurCommitRef.current = true;
        setDraft(focusSnapshotRef.current ?? latest.current.formatted);
      }
    },
    [commitDraft]
  );

  const commit = React.useCallback(() => {
    commitDraft(latest.current.draft);
  }, [commitDraft]);

  return { draft, onDraftChange, onFocus, onBlur, onKeyDown, commit };
};

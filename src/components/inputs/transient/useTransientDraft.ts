import * as React from 'react';
import type { DraftAdmission } from '../draftAdmission';

// Transient (ikke-persisteret) inputtilstand. Til de FÅ flader, hvor et input IKKE er sagsdata og derfor
// ikke hører i den autoritative inputtilstand (§3.1): et overlay/dialog-scratchfelt, hvis værdi kun lever i
// komponentens egen state.
//
// Bevidst adskilt fra den autoritative feltvej: her er ingen feltadresse, intet issue-snapshot, ingen
// `rejectedInputs`, ingen history og ingen persistens. Til gengæld bevares den Mineo-velkendte
// blur-/Enter-commit-mekanik, så et transient felt føles som et rigtigt felt.
//
// Der findes ÉN sådan kerne (denne), så de transiente felter ikke kan drifte fra hinanden.

export type TransientDraftParse<T> =
  | Readonly<{
      ok: true;
      value: T;
      /**
       * En canonical værdi kan stadig have en afledt feltfejl, fx en dato uden for dens aktive interval.
       * Den skal committes, mens kalderen viser fejlen og deaktiverer sin lokale handling.
       */
      issueMessage?: string;
    }>
  | Readonly<{ ok: false; message?: string }>;

export type UseTransientDraftConfig<T> = Readonly<{
  /** Den aktuelle committede værdi (kalderens egen state). */
  value: T;
  /** Kanonisk visning af den committede værdi. Skal være stabil for ækvivalente værdier. */
  format: (value: T) => string;
  /** Parser en rå draft til en værdi, eller afviser den med en besked. */
  parse: (draft: string) => TransientDraftParse<T>;
  /** Kaldes ved et gyldigt commit, evt. med en afledt (ikke-format) feltfejl. */
  onCommit: (next: T, issueMessage?: string) => void;
  /** Kaldes når draften afvises ved commit (fx til at vise en lokal fejl). */
  onReject?: (draft: string, message: string | undefined) => void;
  /**
   * Få transiente felter skal fremstå som Mineos almindelige to-trins-felter. Deres scratch-værdi er
   * stadig ikke sagsdata, men klik-, tastatur- og settle-modellen må ikke afvige af den grund.
   */
  twoStageActivation?: Readonly<{
    acceptsInitialKey: (key: string) => boolean;
  }>;
  /**
   * Feltfamiliens tegn- og længdeprædikat (§1.2). Håndhæves i `onDraftChange` og er derved uafhængigt af
   * indtastningsmodaliteten – et keydown-filter alene virker ikke på mobile skærmtastaturer, som skriver
   * direkte i `<input>` uden en brugbar `keydown` (se `draftAdmission.ts`). Den transiente families
   * redigeringsflade følger BEVIDST det ordinære felts regler, så værnet skal også findes her.
   */
  admission?: DraftAdmission;
}>;

export type TransientDraftState = Readonly<{
  draft: string;
  /** Om en to-trins-editor er åben. Almindelige transiente felter er altid redigerbare. */
  isOpen: boolean;
  onDraftChange: (next: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  onClick: () => void;
  /** Committer draften nu (til eksplicitte handlinger, fx en Beregn-knap i samme dialog). */
  commit: () => void;
  /** Committer en bestemt tekst uden først at skulle skrive den ind i editoren (lukket-felt-paste). */
  commitDraft: (raw: string, closeEditor?: boolean) => void;
}>;

/**
 * Draft/commit-mekanik for et transient felt: draften ejes lokalt, committer på blur og Enter, og
 * Escape fortryder tilbage til den værdi, redigeringen startede fra. Mens feltet er fokuseret,
 * overskrives draften ikke af en ny `value` – ellers ville brugerens indtastning kunne blive
 * trukket væk under fingrene.
 */
export const useTransientDraft = <T>(config: UseTransientDraftConfig<T>): TransientDraftState => {
  const { value, format, parse, onCommit, onReject, twoStageActivation, admission } = config;

  const formatted = format(value);
  const [draft, setDraft] = React.useState(formatted);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const focusSnapshotRef = React.useRef<string | null>(null);
  const suppressNextBlurCommitRef = React.useRef(false);
  const mouseDownWasFocusedRef = React.useRef(false);
  const isTwoStage = twoStageActivation !== undefined;

  // Resync fra den committede værdi, men ALDRIG mens brugeren redigerer.
  const lastFormattedRef = React.useRef(formatted);
  if (!isFocused && formatted !== lastFormattedRef.current) {
    lastFormattedRef.current = formatted;
    if (draft !== formatted) setDraft(formatted);
  }

  // Den råtekst, der sidst blev forsøgt committet. Bruges til no-op-detektion, så en gentagen blur/Enter på en
  // uændret draft ikke committer igen – uden at gøre den FØRSTE commit til en falsk no-op.
  const draftAtLastCommitRef = React.useRef<string | null>(null);

  const latest = React.useRef({ draft, formatted, parse, onCommit, onReject, twoStageActivation, isOpen, isTwoStage, admission });
  latest.current = { draft, formatted, parse, onCommit, onReject, twoStageActivation, isOpen, isTwoStage, admission };

  const commitDraft = React.useCallback((raw: string, closeEditor = false) => {
    const { parse: doParse, onCommit: doCommit, onReject: doReject, formatted: current } = latest.current;
    // Uændret draft = ingen commit. Sammenligningen sker mod den KANONISKE visning af den committede værdi,
    // så en re-formatering (fx '15012026' → '15-01-2026') stadig regnes som en ændring og committes.
    if (raw === current && raw === draftAtLastCommitRef.current) {
      if (closeEditor && latest.current.isTwoStage) {
        latest.current = { ...latest.current, isOpen: false };
        setIsOpen(false);
      }
      return;
    }
    draftAtLastCommitRef.current = raw;
    const result = doParse(raw);
    if (result.ok) {
      doCommit(result.value, result.issueMessage);
      if (closeEditor && latest.current.isTwoStage) {
        const closedText = format(result.value);
        latest.current = { ...latest.current, draft: closedText, isOpen: false };
        setDraft(closedText);
        setIsOpen(false);
      }
      return;
    }
    doReject?.(raw, result.message);
    if (closeEditor && latest.current.isTwoStage) {
      // Rejected tekst er den lukkede visning efter et ugyldigt settle – samme synlige regel som et
      // persisteret datofelt. Den må ikke erstattes af den forrige canonical værdi.
      latest.current = { ...latest.current, draft: raw, isOpen: false };
      setDraft(raw);
      setIsOpen(false);
    }
  }, [format]);

  const onDraftChange = React.useCallback((next: string) => {
    // §1.2: et tegn uden for feltets tegnsæt/længde bliver aldrig en del af draften, og blokeringen er tavs.
    // DOM'en skrives tilbage af kalderen, der ejer `<input>`-referencen.
    if (latest.current.admission !== undefined && !latest.current.admission(next)) return;
    suppressNextBlurCommitRef.current = false;
    latest.current = { ...latest.current, draft: next };
    setDraft(next);
  }, []);

  const onFocus = React.useCallback(() => {
    setIsFocused(true);
    if (!latest.current.isTwoStage) {
      focusSnapshotRef.current = latest.current.draft;
    }
  }, []);

  const onBlur = React.useCallback(() => {
    setIsFocused(false);
    focusSnapshotRef.current = null;
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    if (!latest.current.isTwoStage || latest.current.isOpen) {
      commitDraft(latest.current.draft, latest.current.isTwoStage);
    }
  }, [commitDraft]);

  const openEditor = React.useCallback((initialKey?: string) => {
    if (!latest.current.isTwoStage || latest.current.isOpen) return;
    focusSnapshotRef.current = latest.current.draft;
    const nextDraft = initialKey ?? latest.current.draft;
    latest.current = { ...latest.current, draft: nextDraft, isOpen: true };
    setDraft(nextDraft);
    setIsOpen(true);
  }, []);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (latest.current.isTwoStage && !latest.current.isOpen) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          commitDraft('', true);
          return;
        }
        const acceptsInitialKey = latest.current.twoStageActivation?.acceptsInitialKey;
        const native = e.nativeEvent as unknown as { isComposing?: boolean };
        const isPrintable = !native.isComposing
          && e.key !== 'Process'
          && e.key !== 'Unidentified'
          && !e.ctrlKey
          && !e.metaKey
          && !e.altKey
          && e.key.length === 1;
        if (isPrintable && acceptsInitialKey?.(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          openEditor(e.key);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        suppressNextBlurCommitRef.current = true;
        commitDraft(latest.current.draft, latest.current.isTwoStage);
        return;
      }
      if (e.key === 'Escape') {
        const restoredDraft = focusSnapshotRef.current ?? latest.current.formatted;
        const cancelsAnything = restoredDraft !== latest.current.draft
          || (latest.current.isTwoStage && latest.current.isOpen);
        // ÉN Escape = ÉN handling (`keyboard-navigation.md`). Feltet slugte tasten ubetinget – også når
        // der intet var at annullere – så en omgivende dialog eller et overlay aldrig kunne lukkes med
        // Escape, hvis fokus stod i et af dens felter. Et etttrins-felt er desuden ALTID «åbent», så
        // Escape derfra kunne pr. konstruktion aldrig nå fladen udenom.
        if (!cancelsAnything) return;
        e.preventDefault();
        e.stopPropagation();
        suppressNextBlurCommitRef.current = true;
        latest.current = { ...latest.current, draft: restoredDraft, isOpen: false };
        setDraft(restoredDraft);
        if (latest.current.isTwoStage) setIsOpen(false);
      }
    },
    [commitDraft, openEditor]
  );

  const onMouseDown = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!latest.current.isTwoStage) return;
    const active = document.activeElement;
    mouseDownWasFocusedRef.current =
      active instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(active);
  }, []);

  const onClick = React.useCallback(() => {
    if (!latest.current.isTwoStage) return;
    const shouldOpen = mouseDownWasFocusedRef.current;
    mouseDownWasFocusedRef.current = false;
    if (shouldOpen) openEditor();
  }, [openEditor]);

  const commit = React.useCallback(() => {
    commitDraft(latest.current.draft);
  }, [commitDraft]);

  return {
    draft,
    isOpen: isTwoStage ? isOpen : true,
    onDraftChange,
    onFocus,
    onBlur,
    onKeyDown,
    onMouseDown,
    onClick,
    commit,
    commitDraft,
  };
};

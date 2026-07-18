import * as React from 'react';
import type { FieldRef } from '../fieldDescriptor';
import type { FieldIssue } from '../inputIssue';
import type { EditorLocation } from '../editor/fieldEditorState';
import { useFieldEditor, type FieldEditorController } from './useFieldEditor';
import { readClipboardText } from '../../utils/clipboardUtils';
import type { InputSelectionSnapshot } from '../../utils/inputSelectionUtils';

// Greenfield-React (§2.3/§3.5): den ENE UI-mekanik-lag for et persisteret single-`<input>` formularfelt.
// Den parrer `useFieldEditor`-controlleren (som ejer draft/settle/cancel/clear/commit + dispatch, §3.6) med
// den rene DOM-glue, der IKKE hører til datamodellen: to-trins-aktivering, keydown-skelet, paste-splice,
// caret-genetablering og blur-settle. Denne hook parser ALDRIG, persisterer ALDRIG og holder ingen fejlstate
// — al den logik ligger i codec'et + editor-engine + runner. Den erstatter legacy `useStyledFieldAdapter` +
// `useTwoStageInputActivation`-parringen for formularfelter (§2.4).
//
// Én sandhed for "redigeres nu": editorens `isOpen`. Der er INGEN konkurrerende to-trins-open-flag (§3.5 —
// intet lukket draftkopi/epoch/resync). `readOnly = !isOpen` styrer det redigerbare element.

/** Én-tegns tastfilter delegeret til codec'et: må denne tast åbne editoren som første tegn (§1.3)? */
const isPrintableActivationKey = (
  e: React.KeyboardEvent<HTMLInputElement>,
  acceptsInitialKey: (key: string) => boolean
): boolean => {
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  if (native.isComposing === true || e.key === 'Process' || e.key === 'Unidentified') return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key.length !== 1) return false;
  return acceptsInitialKey(e.key);
};

export type FormFieldSurfaceConfig = Readonly<{
  disabled?: boolean;
  /** Åbn editoren ved første klik uden forudgående fokus (touch/mobil). */
  singleStageClick?: boolean;
  /** Tegnfilter i åben editor (fx dato: kun cifre/separatorer). Kaldes efter Enter/Escape-håndtering. */
  keyFilter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /**
   * Spring `keyFilter` over, mens feltet har en aktiv rød feltfejl. Legacy gatede på `touched && invalid`;
   * i greenfield er feltfejlen den afsluttede revisions issue (§1.8), ikke en draft-afledt fejl.
   */
  gateKeyFilterOnIssue?: boolean;
  /** Sæt caret efter en åben-editor-splice-paste (dato/beløb/brøk). */
  setPasteCaret?: boolean;
  /** Flerlinjede tekstfelter indsætter linjeskift; enkeltlinjefelter settler på Enter. */
  settleOnEnter?: boolean;

  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}>;

export type FormFieldSurface<T> = Readonly<{
  /** Draften i åben tilstand, ellers lukket-visning fra den afsluttede revision (§3.5). Bindes til `<input>`. */
  displayText: string;
  isOpen: boolean;
  /** Feltets aktive røde issue fra det tokenbundne snapshot (§1.8). Vises UÆNDRET under redigering (§1.2). */
  issue: FieldIssue | undefined;
  value: T | undefined;
  inputElementRef: React.RefObject<HTMLInputElement | null>;
  /** `readOnly`-flag til det redigerbare element: sandt når editoren er lukket. */
  readOnly: boolean;

  onDraftChange: (nextDraft: string, selection?: InputSelectionSnapshot) => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;

  /** Den underliggende editor-controller — til immediate-commit-controls (dropdown/toggle) og imperativ brug. */
  controller: FieldEditorController<T>;
}>;

/**
 * Den delte greenfield form-felt-surface. `focusTarget` gives til `useFieldEditor`, så en kritisk handling kan
 * fokusere feltet ved fail-closed. Alt DOM-arbejde her er ren UI-mekanik; datamodellen ejes af controlleren.
 */
export const useFormFieldSurface = <T>(
  field: FieldRef<T>,
  location: EditorLocation,
  config: FormFieldSurfaceConfig = {}
): FormFieldSurface<T> => {
  const {
    disabled = false,
    singleStageClick = false,
    keyFilter,
    gateKeyFilterOnIssue = false,
    setPasteCaret = false,
    settleOnEnter = true,
  } = config;

  const inputElementRef = React.useRef<HTMLInputElement>(null);
  const focusTarget = React.useMemo(
    () => ({ focus: () => inputElementRef.current?.focus({ preventScroll: true }) }),
    []
  );
  const controller = useFieldEditor(field, location, focusTarget);
  const { isOpen } = controller;

  // To-trins-aktivering: mousedown noterer om elementet allerede var fokuseret; klik på et allerede-fokuseret
  // felt åbner editoren (klik 1 fokuserer, klik 2 åbner). `singleStageClick` åbner ved første mousedown.
  const mouseDownWasFocusedRef = React.useRef(false);
  // Sand mens vi udfører vores egen programmatiske blur()+focus() for at etablere caret ved åbning; det blur
  // må ikke settle feltet. Symmetrisk med legacy `shouldIgnoreBlur`.
  const ignoreBlurRef = React.useRef(false);

  // En stabil ref til det aktuelle {controller, config-callbacks}, så event-handlerne kan være stabile uden at
  // churne på hver render (controlleren giver friske callbacks pr. render).
  const latest = React.useRef({
    controller,
    config,
    keyFilter,
    gateKeyFilterOnIssue,
    setPasteCaret,
    disabled,
    singleStageClick,
    settleOnEnter,
  });
  latest.current = {
    controller,
    config,
    keyFilter,
    gateKeyFilterOnIssue,
    setPasteCaret,
    disabled,
    singleStageClick,
    settleOnEnter,
  };

  // Draft-ændring er ren draft-mutation (§1.2): ingen normalisering under redigering, så browserens egen caret
  // holder. Feltfamilier, der normaliserer draften løbende (fx beløbs-tusindpunktummer), tilføjer den mapping
  // i deres egen codec/adapter ved migreringen — den generiske surface holder ingen caret-genskabelse, som
  // ellers ville kunne genskabe en forældet caret ved en senere ekstern revisionsændring.
  const onDraftChange = React.useCallback((nextDraft: string, _selection?: InputSelectionSnapshot) => {
    latest.current.controller.changeDraft(nextDraft);
  }, []);

  // ⚠️ FJERN IKKE — caret-limbo-fixet (jf. legacy useTwoStageInputActivation). Ved editor-åbning på et
  // ALLEREDE-fokuseret element etablerer visse browsere (specifikt <textarea>, men vi gør det ensartet)
  // ikke en redigerbar caret. Et programmatisk blur()+focus() tvinger caret'en frem. `ignoreBlurRef`
  // undertrykker det tilhørende blur, så feltet ikke fejlagtigt settler.
  const prevOpenRef = React.useRef(isOpen);
  React.useLayoutEffect(() => {
    const justOpened = !prevOpenRef.current && isOpen;
    prevOpenRef.current = isOpen;
    if (!justOpened) return;
    const el = inputElementRef.current;
    if (!el || el.readOnly) return;
    if (document.activeElement !== el) return;
    const end = el.value.length;
    const caret = el.selectionStart ?? end;
    ignoreBlurRef.current = true;
    try {
      el.blur();
      el.focus({ preventScroll: true });
      el.setSelectionRange(caret, caret);
    } finally {
      ignoreBlurRef.current = false;
    }
  }, [isOpen]);

  const onMouseDown = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (latest.current.disabled) return;
    if (latest.current.singleStageClick) {
      latest.current.controller.open();
      e.stopPropagation();
      return;
    }
    const active = document.activeElement;
    mouseDownWasFocusedRef.current =
      active instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(active);
  }, []);

  const onClick = React.useCallback((_e: React.MouseEvent<HTMLElement>) => {
    if (latest.current.disabled) return;
    const shouldOpen = mouseDownWasFocusedRef.current;
    mouseDownWasFocusedRef.current = false;
    if (!shouldOpen) return;
    latest.current.controller.open();
  }, []);

  const onFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (ignoreBlurRef.current) return;
    latest.current.config.onFocus?.(e);
  }, []);

  const onBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (ignoreBlurRef.current) return;
    // Blur er en settle-sti (§1.3): en åben editor settler; en lukket editor er no-op (controlleren guarder).
    latest.current.controller.settle();
    latest.current.config.onBlur?.(e);
  }, []);

  const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const { controller: ctl, config: cfg, keyFilter: filter, gateKeyFilterOnIssue: gate, disabled: dis } = latest.current;
    if (dis) return;

    if (!ctl.isOpen) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // §1.3: Delete/Backspace på et lukket, fokuseret felt rydder og committer straks.
        e.preventDefault();
        e.stopPropagation();
        ctl.clearImmediate();
        return;
      }
      if (isPrintableActivationKey(e, field.descriptor.codec.acceptsInitialKey)) {
        // Tast-initieret åbning (§1.3): editoren seedes med det første tegn.
        e.preventDefault();
        e.stopPropagation();
        ctl.open(e.key);
        return;
      }
      cfg.onKeyDown?.(e);
      return;
    }

    if (e.key === 'Enter' && latest.current.settleOnEnter) {
      e.preventDefault();
      ctl.settle();
      cfg.onKeyDown?.(e);
      return;
    }
    if (e.key === 'Escape') {
      // Escape lukker uden command; et efterfølgende blur settler ikke (editoren er da lukket, §1.3).
      e.preventDefault();
      ctl.cancel();
      return;
    }
    if (filter && !(gate && ctl.issue !== undefined)) {
      filter(e);
    }
    cfg.onKeyDown?.(e);
  }, [field]);

  const onPaste = React.useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const { controller: ctl, setPasteCaret: caret, disabled: dis } = latest.current;
    if (dis) return;
    const normalize = field.descriptor.codec.normalizePaste ?? ((raw: string) => raw);
    const normalized = normalize(readClipboardText(e));
    e.preventDefault();
    e.stopPropagation();
    if (normalized === '') return;

    if (!ctl.isOpen) {
      // Lukket paste er en afsluttet inputhandling: commit straks gennem samme codec/settle-sti som grid.
      // Editorens åbne draft må ikke efterlades som en skjult mellemtilstand efter clipboard-handlingen.
      ctl.open(normalized);
      ctl.settle();
      return;
    }

    // Åben paste: splice ind i draften på caret-positionen.
    const input = inputElementRef.current;
    const draft = ctl.displayText;
    const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
    const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
    ctl.changeDraft(draft.slice(0, start) + normalized + draft.slice(end));

    if (caret) {
      const nextCaret = start + normalized.length;
      requestAnimationFrame(() => {
        const el = inputElementRef.current;
        if (!el) return;
        try {
          el.setSelectionRange(nextCaret, nextCaret);
        } catch {
          // no-op
        }
      });
    }
  }, [field]);

  return {
    displayText: controller.displayText,
    isOpen,
    issue: controller.issue,
    value: controller.value,
    inputElementRef,
    readOnly: !isOpen,
    onDraftChange,
    onFocus,
    onBlur,
    onKeyDown,
    onMouseDown,
    onClick,
    onPaste,
    controller,
  };
};

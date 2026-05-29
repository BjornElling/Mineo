import * as React from 'react';
import { readClipboardText } from '../utils/clipboardUtils';

export type TwoStageStartSource = 'click' | 'key' | 'paste';

type TwoStageKeyDownEvent = React.KeyboardEvent<HTMLElement>;

const isComposing = (e: TwoStageKeyDownEvent): boolean => {
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  return native.isComposing === true || e.key === 'Process' || e.key === 'Unidentified';
};

const isBypassKeyEvent = (e: TwoStageKeyDownEvent): boolean => {
  if (isComposing(e)) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return false;
};

const isPrintableCharacter = (e: TwoStageKeyDownEvent): boolean => {
  if (isBypassKeyEvent(e)) return false;
  return e.key.length === 1;
};

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

type TwoStageConfig = Readonly<{
  disabled?: boolean;
  /** Åbn editor ved første klik uden forudgående fokus (til mobil/touch). */
  singleStageClick?: boolean;
  getDraftForKey: (key: string) => string | null;
  normalizePasteText?: (text: string) => string;
  onStartEditing?: (source: TwoStageStartSource) => void;
  onReplaceDraft?: (draft: string, source: Exclude<TwoStageStartSource, 'click'>) => void;
  /**
   * Ref til det redigerbare felt-element (input/textarea) hvis editing-tilstand
   * styres via `readOnly = !isEditorOpen`.
   *
   * Når dette gives, etablerer hook'en en aktiv caret når editoren åbnes på et
   * element der ALLEREDE har fokus (det typiske to-trins-tilfælde: klik 1 fokuserer,
   * klik 2 åbner). Uden dette undlader visse browsere — specifikt for `<textarea>` —
   * at give en redigerbar caret før næste fokus-interaktion, hvilket fremstår som
   * et "ekstra klik kræves" (limbo-tilstand: fokuseret + ikke-readonly, men ingen
   * caret). Se `shouldIgnoreBlur` for den tilhørende blur-undertrykkelse.
   */
  editableElementRef?: React.RefObject<EditableElement | null>;
}>;

export type UseTwoStageInputActivationResult<TElement extends HTMLElement> = Readonly<{
  isEditorOpen: boolean;
  openEditor: (source: TwoStageStartSource) => void;
  closeEditor: () => void;
  handleMouseDown: (e: React.MouseEvent<TElement>) => void;
  handleClick: (e: React.MouseEvent<TElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<TElement>) => void;
  handlePaste: (e: React.ClipboardEvent<TElement>) => void;
  /**
   * Sand mens hook'en udfører sin egen programmatiske blur()+focus() for at
   * etablere en caret ved editor-åbning. Consumeren SKAL kalde denne i toppen af
   * sin `onBlur` og springe alle side-effekter over (commit/luk/fokus-bogføring),
   * når den er sand — ellers committer/lukker det interne blur fejlagtigt feltet.
   */
  shouldIgnoreBlur: () => boolean;
}>;

export const useTwoStageInputActivation = <TElement extends HTMLElement>(
  config: TwoStageConfig
): UseTwoStageInputActivationResult<TElement> => {
  const { disabled = false, singleStageClick = false, getDraftForKey, normalizePasteText, onStartEditing, onReplaceDraft, editableElementRef } = config;

  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const mouseDownWasFocusedRef = React.useRef(false);

  // ⚠️ FJERN IKKE DENNE EFFEKT — den løser "tre-klik / caret-limbo"-fejlen.
  //
  // Problem: To-trins-aktivering åbner editoren ved at fjerne `readOnly` på et
  // element der ALLEREDE har fokus (klik 1 fokuserer mens readOnly=true, klik 2
  // åbner). Når `readOnly` fjernes fra et allerede-fokuseret `<textarea>`,
  // etablerer browseren IKKE en redigerbar caret før næste fokus-interaktion.
  // Symptomet er en "limbo"-tilstand: feltet er fokuseret og ikke-readonly, men
  // tastetryk producerer hverken `beforeinput` eller `input` — brugeren oplever at
  // skulle klikke en tredje gang. `<input>` rammes ikke; det er en browser-quirk
  // specifik for textarea, og den kan IKKE reproduceres i jsdom (kun i en rigtig
  // browser), så automatiske tests fanger ikke en regression her.
  //
  // Fix: ved editor-åbning (`isEditorOpen` false→true) tvinger blur()+focus()
  // browseren til at re-etablere en aktiv caret. `shouldIgnoreBlur()` lader
  // consumeren springe sine onBlur-side-effekter (commit/luk) over under det
  // programmatiske skift, så feltet ikke fejlagtigt lukkes/committes.
  //
  // Hvis du overvejer at forenkle dette væk: verificér FØRST manuelt i en browser
  // at to klik på et tomt textarea giver en redigerbar caret. Gør det ikke.
  const prevEditorOpenRef = React.useRef(isEditorOpen);
  const ignoreBlurRef = React.useRef(false);
  const shouldIgnoreBlur = React.useCallback(() => ignoreBlurRef.current, []);
  React.useLayoutEffect(() => {
    const justOpened = !prevEditorOpenRef.current && isEditorOpen;
    prevEditorOpenRef.current = isEditorOpen;
    if (!justOpened) return;
    const el = editableElementRef?.current;
    if (!el || el.readOnly) return;
    if (document.activeElement !== el) return; // kun det allerede-fokuserede tilfælde
    // Bevar caret-positionen fra klikket: læs den eksisterende selection FØR blur
    // og genskab den efter focus. På et tomt felt er start/end = 0; på et udfyldt
    // felt lander caret'en dér hvor brugeren klikkede — identisk med de øvrige
    // inputfelter. (`selectionStart` kan være null for visse input-typer; i så fald
    // falder vi tilbage til enden af teksten.)
    const end = el.value.length;
    const start = el.selectionStart ?? end;
    const stop = el.selectionEnd ?? start;
    ignoreBlurRef.current = true;
    try {
      el.blur();
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, stop);
    } finally {
      ignoreBlurRef.current = false;
    }
  }, [editableElementRef, isEditorOpen]);

  const openEditor = React.useCallback(
    (source: TwoStageStartSource) => {
      if (disabled) return;
      if (isEditorOpen) return;
      setIsEditorOpen(true);
      onStartEditing?.(source);
    },
    [disabled, isEditorOpen, onStartEditing]
  );

  const closeEditor = React.useCallback(() => {
    setIsEditorOpen(false);
    mouseDownWasFocusedRef.current = false;
  }, []);

  const handleMouseDown = React.useCallback((e: React.MouseEvent<TElement>) => {
    if (disabled) return;
    if (singleStageClick) {
      openEditor('click');
      e.stopPropagation();
      return;
    }
    const active = document.activeElement;
    mouseDownWasFocusedRef.current =
      active instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(active);
  }, [disabled, singleStageClick, openEditor]);

  const handleClick = React.useCallback((_e: React.MouseEvent<TElement>) => {
    if (disabled) return;
    const shouldOpenFromClick = mouseDownWasFocusedRef.current;
    mouseDownWasFocusedRef.current = false;
    if (!shouldOpenFromClick) return;
    openEditor('click');
  }, [disabled, openEditor]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<TElement>) => {
    if (disabled) return;
    if (isEditorOpen) return;

    if (!isPrintableCharacter(e)) return;

    const nextDraft = getDraftForKey(e.key);
    if (nextDraft === null) return;

    e.preventDefault();
    e.stopPropagation();
    openEditor('key');
    onReplaceDraft?.(nextDraft, 'key');
  }, [disabled, getDraftForKey, isEditorOpen, onReplaceDraft, openEditor]);

  const handlePaste = React.useCallback((e: React.ClipboardEvent<TElement>) => {
    if (disabled) return;
    if (isEditorOpen) return;

    const text = readClipboardText(e);
    const normalized = typeof normalizePasteText === 'function' ? normalizePasteText(text) : text;
    if (normalized === '') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    onReplaceDraft?.(normalized, 'paste');
  }, [disabled, isEditorOpen, normalizePasteText, onReplaceDraft]);

  return {
    isEditorOpen,
    openEditor,
    closeEditor,
    handleMouseDown,
    handleClick,
    handleKeyDown,
    handlePaste,
    shouldIgnoreBlur,
  };
};

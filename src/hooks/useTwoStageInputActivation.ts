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

type TwoStageConfig = Readonly<{
  disabled?: boolean;
  /** Åbn editor ved første klik uden forudgående fokus (til mobil/touch). */
  singleStageClick?: boolean;
  getDraftForKey: (key: string) => string | null;
  normalizePasteText?: (text: string) => string;
  onStartEditing?: (source: TwoStageStartSource) => void;
  onReplaceDraft?: (draft: string, source: Exclude<TwoStageStartSource, 'click'>) => void;
}>;

export type UseTwoStageInputActivationResult<TElement extends HTMLElement> = Readonly<{
  isEditorOpen: boolean;
  openEditor: (source: TwoStageStartSource) => void;
  closeEditor: () => void;
  handleMouseDown: (e: React.MouseEvent<TElement>) => void;
  handleClick: (e: React.MouseEvent<TElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<TElement>) => void;
  handlePaste: (e: React.ClipboardEvent<TElement>) => void;
}>;

export const useTwoStageInputActivation = <TElement extends HTMLElement>(
  config: TwoStageConfig
): UseTwoStageInputActivationResult<TElement> => {
  const { disabled = false, singleStageClick = false, getDraftForKey, normalizePasteText, onStartEditing, onReplaceDraft } = config;

  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const mouseDownWasFocusedRef = React.useRef(false);

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
  };
};

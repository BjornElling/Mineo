import React, { useState, useRef, useCallback } from 'react';

/**
 * Type for synthetic change event
 */
export interface FieldChangeEvent {
  target: {
    value: unknown;
  };
}

/**
 * Return type for useFieldBehavior hook
 */
export interface UseFieldBehaviorReturn {
  isFocused: boolean;
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.RefObject<HTMLElement | null>;
  handleFocus: (e?: React.FocusEvent<HTMLElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

/**
 * Centraliseret field behavior hook
 *
 * Håndterer fælles funktionalitet for alle input-felter:
 * - Focus state
 * - Escape-key handling (fortryd ændringer)
 * - Oprindelig værdi reference
 * - Input ref forwarding
 *
 * @param value - Nuværende værdi af feltet
 * @param onChange - onChange callback ved Escape-tast
 * @returns Hook interface med focus state og event handlers
 */
export const useFieldBehavior = (
  value: unknown,
  onChange?: (e: FieldChangeEvent) => void
): UseFieldBehaviorReturn => {
  const [isFocused, setIsFocused] = useState(false);
  const originalValueRef = useRef(value);
  const inputRef = useRef<HTMLElement | null>(null);

  /**
   * Håndter focus - gem oprindelig værdi
   */
  const handleFocus = useCallback((_e?: React.FocusEvent<HTMLElement>) => {
    setIsFocused(true);
    originalValueRef.current = value;
  }, [value]);

  const resetCaretColor = useCallback(() => {
    const maybeInput = inputRef.current?.querySelector?.('input') || inputRef.current;
    if (maybeInput && 'style' in maybeInput) {
      (maybeInput as HTMLInputElement).style.caretColor = '';
    }
  }, []);

  /**
   * Håndter blur - opdater focus state
   */
  const handleBlur = useCallback(() => {
    resetCaretColor();
    setIsFocused(false);
  }, [resetCaretColor]);

  /**
   * Håndter Escape-tast - gendan oprindelig værdi
   */
  const handleEscape = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Gendan den oprindelige værdi
      if (onChange) {
        const syntheticEvent: FieldChangeEvent = {
          target: { value: originalValueRef.current }
        };
        onChange(syntheticEvent);
      }
      // Fjern tekstmarkør visuelt men behold fokus
      const maybeInput = inputRef.current?.querySelector?.('input') || inputRef.current;
      if (maybeInput && 'setSelectionRange' in maybeInput) {
        const input = maybeInput as HTMLInputElement;
        input.setSelectionRange?.(0, 0);
        input.style.caretColor = 'transparent';
      }
    }
  }, [onChange]);

  /**
   * Samlet keydown handler
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    handleEscape(e);
  }, [handleEscape]);

  return {
    isFocused,
    setIsFocused,
    inputRef,
    handleFocus,
    handleBlur,
    handleKeyDown,
  };
};

export default useFieldBehavior;

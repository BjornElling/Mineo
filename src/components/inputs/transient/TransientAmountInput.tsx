import * as React from 'react';
import { InputAdornment } from '@mui/material';
import StyledTextFieldBase from '../StyledTextFieldBase';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { parseAmountInput, amountValueToDraftString } from '../../../utils/expressionAmount';
import { useTransientDraft } from './useTransientDraft';
import { amountExpressionAdmission, keyFilterFromAdmission, restoreDomValueAfterRejectedDraft } from '../draftAdmission';
import { readClipboardText } from '../../../utils/clipboardUtils';
import { spliceDraftWithPaste } from '../../../inputCore/react/pasteSplice';
import { assignRef } from '../../../utils/refUtils';
import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from '../../../utils/amountInputUtils';

// Transient beløbsfelt (§3.1-undtagelse: IKKE sagsdata). Bruges i overlays/dialoger, hvor beløbet kun lever
// i komponentens egen state — fx løntrin-finderens ekstra grundløn. Deler beløbs-/udtryks-parse-kernen
// (`parseAmountInput`) og tegnfilteret med de persisterede beløbsfelter, så indtastningsreglerne er ens;
// men den har hverken feltadresse, issue-snapshot, history eller persistens.

export type TransientAmountInputProps = Readonly<{
  value: AmountValue | undefined;
  onCommit: (next: AmountValue | undefined) => void;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  /** Vist fejl (ejes af kalderen, som også rydder den ved et nyt commit). */
  errorMessage?: string;
  /** Kaldes når draften afvises ved commit, så kalderen kan vise sin egen fejl. */
  onReject?: (message: string) => void;
  width?: number | string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  'aria-label'?: string;
}>;

const TransientAmountInput = React.forwardRef<HTMLDivElement, TransientAmountInputProps>(
  (
    {
      value,
      onCommit,
      allowNegative = false,
      allowDecimals = true,
      errorMessage,
      onReject,
      width,
      placeholder,
      inputRef,
      ...rest
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement | null>(null);
    const admission = React.useMemo(() => {
      const charAdmission = amountExpressionAdmission({
        allowNegative,
        allowDecimals,
        maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
        maxDecimalDigits: allowDecimals ? DEFAULT_AMOUNT_PRECISION : 0,
      });
      return charAdmission;
    }, [allowDecimals, allowNegative]);
    const draftState = useTransientDraft<AmountValue | undefined>({
      value,
      format: (v) => amountValueToDraftString(v, DEFAULT_AMOUNT_PRECISION),
      parse: (draft) => {
        const parsed = parseAmountInput(draft, {
          precision: DEFAULT_AMOUNT_PRECISION,
          allowNegative,
          allowDecimals,
          maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
          maxRawLength: MAX_AMOUNT_RAW_LENGTH,
        });
        if (!parsed.ok) return { ok: false, message: parsed.error.message };
        return { ok: true, value: parsed.value };
      },
      onCommit,
      onReject: (_draft, message) => onReject?.(message ?? 'Ugyldigt beløb'),
      admission,
    });

    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputRef]
    );

    const handleDraftChange = React.useCallback((next: string) => {
      if (!admission(next)) {
        // Et afvist input-event ændrer DOM'en, selv om den kontrollerede draft forbliver uændret.
        // Skriv den accepterede tekst tilbage, så DOM og draft ikke kan vise to forskellige værdier.
        restoreDomValueAfterRejectedDraft(inputElementRef.current, draftState.draft);
        return;
      }
      draftState.onDraftChange(next);
    }, [admission, draftState]);

    const keyFilter = React.useMemo(() => keyFilterFromAdmission(admission), [admission]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      draftState.onKeyDown(event);
      if (!event.defaultPrevented) keyFilter(event);
    }, [draftState, keyFilter]);

    const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const draft = draftState.draft;
      const element = inputElementRef.current;
      const start = typeof element?.selectionStart === 'number' ? element.selectionStart : draft.length;
      const end = typeof element?.selectionEnd === 'number' ? element.selectionEnd : start;
      const spliced = spliceDraftWithPaste(
        draft,
        readClipboardText(event),
        start,
        end,
        MAX_AMOUNT_RAW_LENGTH,
        admission
      );
      if (spliced.acceptedLength === 0) {
        restoreDomValueAfterRejectedDraft(inputElementRef.current, draft);
        return;
      }
      draftState.onDraftChange(spliced.draft);
      requestAnimationFrame(() => {
        const currentElement = inputElementRef.current;
        if (!currentElement) return;
        try {
          currentElement.setSelectionRange(spliced.caret, spliced.caret);
        } catch {
          // no-op
        }
      });
    }, [admission, draftState]);

    return (
      <StyledTextFieldBase
        ref={ref}
        inputRef={assignInputRef}
        width={width}
        placeholder={placeholder}
        draft={draftState.draft}
        onDraftChange={handleDraftChange}
        onFocus={draftState.onFocus}
        onBlur={draftState.onBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? ''}
        endAdornment={<InputAdornment position="end">kr.</InputAdornment>}
        htmlInputAttributes={{
          inputMode: allowDecimals ? 'decimal' : 'numeric',
          maxLength: MAX_AMOUNT_RAW_LENGTH,
          'aria-label': rest['aria-label'],
        }}
      />
    );
  }
);

TransientAmountInput.displayName = 'TransientAmountInput';

export default TransientAmountInput;

import * as React from 'react';
import { InputAdornment } from '@mui/material';
import StyledTextFieldBase from '../StyledTextFieldBase';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { parseAmountInput, amountValueToDraftString } from '../../../utils/expressionAmount';
import { useTransientDraft } from './useTransientDraft';

// Transient beløbsfelt (§3.1-undtagelse: IKKE sagsdata). Bruges i overlays/dialoger, hvor beløbet kun lever
// i komponentens egen state — fx løntrin-finderens ekstra grundløn. Deler beløbs-/udtryks-parse-kernen
// (`parseAmountInput`) og tegnfilteret med de persisterede beløbsfelter, så indtastningsreglerne er ens;
// men den har hverken feltadresse, issue-snapshot, history eller persistens.

const AMOUNT_PRECISION = 2;

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
    const draftState = useTransientDraft<AmountValue | undefined>({
      value,
      format: (v) => amountValueToDraftString(v, AMOUNT_PRECISION),
      parse: (draft) => {
        const parsed = parseAmountInput(draft, {
          precision: AMOUNT_PRECISION,
          allowNegative,
          allowDecimals,
        });
        if (!parsed.ok) return { ok: false, message: parsed.error.message };
        return { ok: true, value: parsed.value };
      },
      onCommit,
      onReject: (_draft, message) => onReject?.(message ?? 'Ugyldigt beløb'),
    });

    return (
      <StyledTextFieldBase
        ref={ref}
        inputRef={inputRef}
        width={width}
        placeholder={placeholder}
        draft={draftState.draft}
        onDraftChange={(next) => draftState.onDraftChange(next)}
        onFocus={draftState.onFocus}
        onBlur={draftState.onBlur}
        // Bevidst UDEN tegnfilter: filteret læser DOM-værdien, som halter bag den kontrollerede draft.
        // Korrektheden ligger ved commit gennem den DELTE `parseAmountInput` (samme besked som persisterede felter).
        onKeyDown={draftState.onKeyDown}
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? ''}
        endAdornment={<InputAdornment position="end">kr.</InputAdornment>}
        htmlInputAttributes={{ inputMode: 'decimal', 'aria-label': rest['aria-label'] }}
      />
    );
  }
);

TransientAmountInput.displayName = 'TransientAmountInput';

export default TransientAmountInput;

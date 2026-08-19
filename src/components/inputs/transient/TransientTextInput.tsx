import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../StyledTextFieldBase';
import StyledTextAreaBase from '../StyledTextAreaBase';

// Transient tekstfelt (§3.1-undtagelse: IKKE sagsdata). Bruges hvor teksten kun lever i komponentens egen
// state – fx rapport-dialogens beskedfelt. Fri tekst har intet parse-/commit-begreb, så feltet er styret
// direkte på draften: hver tastning ER værdien. Derfor bruger den ikke `useTransientDraft` (som findes for
// de felter, der har en parse-/commit-grænse).

type CommonProps = Readonly<{
  value: string;
  onChange: (next: string) => void;
  width?: number | string;
  fullWidth?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  sx?: SxProps<Theme>;
  'aria-label'?: string;
}>;

export type TransientTextInputProps = CommonProps &
  Readonly<{
    /** Flerlinjet felt (kommentar/beskrivelse). `rows` gælder kun her. */
    multiline?: boolean;
    rows?: number;
    label?: React.ReactNode;
    maxLength?: number;
    inputRef?: React.Ref<HTMLInputElement>;
  }>;

const TransientTextInput = ({
  value,
  onChange,
  width,
  fullWidth,
  placeholder,
  disabled,
  autoFocus,
  multiline,
  rows,
  label,
  maxLength,
  inputRef,
  sx,
  ...rest
}: TransientTextInputProps) => {
  if (multiline === true) {
    return (
      <StyledTextAreaBase
        accessibleName={rest['aria-label'] ?? 'Tekst'}
        width={width}
        fullWidth={fullWidth}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        sx={sx}
        rows={rows}
        draft={value}
        onDraftChange={onChange}
        // `maxLength` faldt på gulvet i den flerlinjede gren: proppen var erklæret, men kun
        // enkeltlinje-grenen videresendte den. Rapportfeltet var derfor helt ubegrænset i længde.
        htmlTextAreaAttributes={maxLength === undefined ? {} : { maxLength }}
      />
    );
  }

  return (
    <StyledTextFieldBase
      accessibleName={rest['aria-label'] ?? (typeof label === 'string' ? label : 'Tekst')}
      inputRef={inputRef}
      width={width}
      fullWidth={fullWidth}
      placeholder={placeholder}
      label={label}
      disabled={disabled}
      autoFocus={autoFocus}
      sx={sx}
      draft={value}
      onDraftChange={(next) => onChange(next)}
      htmlInputAttributes={{ ...(maxLength === undefined ? {} : { maxLength }) }}
    />
  );
};

TransientTextInput.displayName = 'TransientTextInput';

export default TransientTextInput;

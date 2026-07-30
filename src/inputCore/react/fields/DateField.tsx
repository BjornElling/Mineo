import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../../../components/inputs/StyledTextFieldBase';
import type { ISODateString } from '../../../types/branded';
import { filterDateLikeKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFormFieldSurface } from '../useFormFieldSurface';
import { resolveFieldIssueText } from '../fieldIssueText';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';
import { DATE_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';

// Dato-felt (§2.4/§3.5): tynd skal over `useFormFieldSurface`. Format/parse/paste-normalisering
// ejes af descriptorens dato-codec; kronologiske min/max-bounds er FELTVALIDATORER på den canonical værdi
// (§1.6, Fase 3), IKKE komponent-props. Komponenten viser derfor kun feltets aktive issue fra det tokenbundne
// snapshot (§1.8) og modtager ingen `minDate`/`maxDate`/`onFieldError` mere.

const MAX_CANONICAL_DANISH_DATE_LENGTH = 10; // dd-mm-åååå
// Tillad lidt flere draft-tegn end den kanoniske form (eftergivende typing af separatorer/whitespace).
const MAX_DRAFT_LENGTH = MAX_CANONICAL_DANISH_DATE_LENGTH + 6;

export type DateFieldProps = Readonly<{
  field: FieldRef<ISODateString | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const DateField = React.forwardRef<HTMLDivElement, DateFieldProps>(
  ({ field, location, name, width = 130, placeholder = DATE_FORMAT_PLACEHOLDER, disabled, singleStageClick = false, inputRef, sx }, ref) => {
    const surface = useFormFieldSurface(field, location, {
      disabled,
      singleStageClick,
      keyFilter: filterDateLikeKeyDown,
      // Gate tegnfilteret, når feltet har en aktiv rød fejl, så brugeren kan rette den fejlende råtekst frit.
      gateKeyFilterOnIssue: true,
      setPasteCaret: true,
    });

    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        surface.inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputRef, surface.inputElementRef]
    );

    const issueText = resolveFieldIssueText(surface.issue);
    const hasError = issueText.message !== undefined;

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={surface.displayText}
        onDraftChange={surface.onDraftChange}
        inputRef={assignInputRef}
        onFocus={surface.onFocus}
        onBlur={surface.onBlur}
        onKeyDown={surface.onKeyDown}
        onMouseDown={surface.onMouseDown}
        onClick={surface.onClick}
        onPaste={surface.onPaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={hasError}
        helperText={issueText.message ?? ''}
        {...(issueText.tooltip === undefined ? {} : { tooltipText: issueText.tooltip })}
        htmlInputAttributes={{ inputMode: 'numeric', maxLength: MAX_DRAFT_LENGTH, readOnly: surface.readOnly, ...surface.restoreTargetAttributes }}
        sx={mergeSx({
          '& .MuiInputBase-input': {
            textAlign: 'center',
            caretColor: surface.isOpen ? 'auto' : 'transparent',
            cursor: surface.isOpen ? 'text' : 'pointer',
          },
        }, sx)}
      />
    );
  }
);

DateField.displayName = 'DateField';

export default DateField;

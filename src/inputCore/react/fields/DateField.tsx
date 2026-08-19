import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../../../components/inputs/StyledTextFieldBase';
import type { ISODateString } from '../../../types/branded';
import { dateLikeAdmission, keyFilterFromAdmission } from '../../../components/inputs/draftAdmission';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFormFieldSurface } from '../useFormFieldSurface';
import { resolveFieldIssueText } from '../fieldIssueText';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';
import { DATE_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';
import { resolveFormLengthPolicy } from './charLengthPolicy';
import { useFieldLabel } from '../useFieldLabel';

// Dato-felt (§2.4/§3.5): tynd skal over `useFormFieldSurface`. Format/parse/paste-normalisering
// ejes af descriptorens dato-codec; kronologiske min/max-bounds er FELTVALIDATORER på den canonical værdi
// (§1.6, inputkernen), IKKE komponent-props. Komponenten viser derfor kun feltets aktive issue fra det tokenbundne
// snapshot (§1.8) og modtager ingen `minDate`/`maxDate`/`onFieldError` mere.

// Ét prædikat for datoformen; keydown-filteret afledes af PRÆCIS samme prædikat, så de to værn ikke kan
// drifte fra hinanden (§1.2, se `draftAdmission.ts`).
const DATE_ADMISSION = dateLikeAdmission();
const DATE_KEY_FILTER = keyFilterFromAdmission(DATE_ADMISSION);

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
    const accessibleName = useFieldLabel(field);
    // Datoformens rå loft er erklæret på codecet og læses gennem den DELTE resolver – samme kilde som
    // grid-cellen.
    const { maxDraftLength } = resolveFormLengthPolicy(field);
    const surface = useFormFieldSurface(field, location, {
      disabled,
      singleStageClick,
      keyFilter: DATE_KEY_FILTER,
      draftAdmission: DATE_ADMISSION,
      // Samme loft som `<input maxLength>` nedenfor; paste kan ikke bruge elementets eget loft (§1.2a).
      maxDraftLength,
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
        accessibleName={accessibleName}
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
        htmlInputAttributes={{ inputMode: 'numeric', maxLength: maxDraftLength, readOnly: surface.readOnly, ...surface.restoreTargetAttributes }}
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

import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase, { type StyledTextFieldBaseInputType } from '../../../components/inputs/StyledTextFieldBase';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFormFieldSurface } from '../useFormFieldSurface';
import { resolveFieldIssueText } from '../fieldIssueText';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';
import { useFieldLabel } from '../useFieldLabel';

// Tekst-felt (§2.4/§3.5): en TYND skal over `useFormFieldSurface`. Modtager KUN sin konkrete
// `field`/`location` — ikke `value`, `parse`, `format`, `onCommit`, invalid-key eller error-reporter (§2.4:
// "et callsite er først migreret, når det kun modtager sin ref/editorlocation"). Al datamodel-logik ligger i
// codec'et + editor-engine + runner; komponenten ejer kun rendering, hit-area og navigation.

export type TextFieldProps = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;

  width?: number | string;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  inputType?: StyledTextFieldBaseInputType;
  sx?: SxProps<Theme>;
  /** Åbn editoren ved første klik uden forudgående fokus (touch/mobil). */
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}>;

const TextField = React.forwardRef<HTMLDivElement, TextFieldProps>(
  ({ field, location, width, id, name, placeholder, disabled, inputType = 'text', sx, singleStageClick = false, inputRef }, ref) => {
    const accessibleName = useFieldLabel(field);
    // Længden er erklæret på codec'en (§2.5) og håndhæves BÅDE som `<input maxLength>` (tastning) og
    // gennem surfacens paste-splice, hvor elementets eget loft ikke virker (§1.2a).
    const maxLength = field.descriptor.codec.maxLength;
    const surface = useFormFieldSurface(field, location, {
      disabled,
      singleStageClick,
      ...(maxLength === undefined ? {} : { maxDraftLength: maxLength }),
    });

    const mergedInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        surface.inputElementRef.current = node;
        assignRef<HTMLInputElement>(inputRef, node);
      },
      [inputRef, surface.inputElementRef]
    );

    const issueText = resolveFieldIssueText(surface.issue);
    const hasError = issueText.message !== undefined;

    return (
      <StyledTextFieldBase
        ref={ref}
        id={id}
        name={name}
        accessibleName={accessibleName}
        placeholder={placeholder}
        draft={surface.displayText}
        onDraftChange={surface.onDraftChange}
        inputRef={mergedInputRef}
        onFocus={surface.onFocus}
        onBlur={surface.onBlur}
        onKeyDown={surface.onKeyDown}
        onMouseDown={surface.onMouseDown}
        onClick={surface.onClick}
        onPaste={surface.onPaste}
        inputType={inputType}
        width={width}
        disabled={disabled}
        error={hasError}
        helperText={issueText.message ?? ''}
        {...(issueText.tooltip === undefined ? {} : { tooltipText: issueText.tooltip })}
        htmlInputAttributes={{
          ...(maxLength === undefined ? {} : { maxLength }),
          readOnly: surface.readOnly,
          ...surface.restoreTargetAttributes,
        }}
        sx={mergeSx({
          '& .MuiInputBase-input': {
            caretColor: surface.isOpen ? 'auto' : 'transparent',
            cursor: surface.isOpen ? 'text' : 'pointer',
          },
        }, sx)}
      />
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;

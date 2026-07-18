import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextAreaBase from '../../../components/inputs/StyledTextAreaBase';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFormFieldSurface } from '../useFormFieldSurface';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';

// Greenfield flerlinjet tekst-felt (§2.4/§3.5): en TYND skal over `useFormFieldSurface` + `StyledTextAreaBase`.
// Grid-pendanten til `GreenfieldTextField`, men med en <textarea>. Modtager KUN sin `field`/`location`; al
// datamodel-logik ligger i codec'et + editor-engine + runner. Erstatter legacy `StyledTextField multiline`.

export type GreenfieldMultilineTextFieldProps = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;

  width?: number | string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  singleStageClick?: boolean;
  sx?: SxProps<Theme>;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}>;

const GreenfieldMultilineTextField = React.forwardRef<HTMLDivElement, GreenfieldMultilineTextFieldProps>(
  ({ field, location, width, name, placeholder, disabled, rows, singleStageClick = false, sx, inputRef }, ref) => {
    const surface = useFormFieldSurface(field, location, { disabled, singleStageClick });

    const assignInputRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        // Surface-refen er typet på HTMLInputElement, men InputBase/textarea deler DOM-fokus-API'et vi bruger.
        (surface.inputElementRef as React.MutableRefObject<HTMLElement | null>).current = node;
        assignRef<HTMLTextAreaElement>(inputRef, node);
      },
      [inputRef, surface.inputElementRef]
    );

    const hasError = surface.issue !== undefined;

    // Surface-handlerne er typet på <input>, men bruger kun generiske event-props (`.key`,
    // `.currentTarget.value`, selection, `document.activeElement`), som <textarea> også har. Wrap dem, så vi
    // forwarder <textarea>-eventet uden en usikker element-cast på hele handler-typen.
    const onFocus = React.useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => surface.onFocus(e as unknown as React.FocusEvent<HTMLInputElement>),
      [surface]
    );
    const onBlur = React.useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => surface.onBlur(e as unknown as React.FocusEvent<HTMLInputElement>),
      [surface]
    );
    const onKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => surface.onKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>),
      [surface]
    );
    const onMouseDown = React.useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => surface.onMouseDown(e),
      [surface]
    );
    const onClick = React.useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => surface.onClick(e),
      [surface]
    );
    const onPaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => surface.onPaste(e as unknown as React.ClipboardEvent<HTMLInputElement>),
      [surface]
    );

    return (
      <StyledTextAreaBase
        ref={ref}
        name={name}
        placeholder={placeholder}
        draft={surface.displayText}
        onDraftChange={surface.onDraftChange}
        inputRef={assignInputRef}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onPaste={onPaste}
        width={width}
        disabled={disabled}
        rows={rows}
        error={hasError}
        helperText={surface.issue?.message ?? ''}
        htmlTextAreaAttributes={{ readOnly: surface.readOnly }}
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

GreenfieldMultilineTextField.displayName = 'GreenfieldMultilineTextField';

export default GreenfieldMultilineTextField;

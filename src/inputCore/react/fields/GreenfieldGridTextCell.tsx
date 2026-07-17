import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../../utils/mergeSx';
import { visuallyHiddenStyle } from '../../../components/shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from '../../../components/inputs/table/tableInputStyles';
import { useGridCoreApi } from '../../../components/tables/useGridCore';
import { assignRef } from '../../../utils/refUtils';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import type { CellSpec } from '../useCellEditor';
import { useGridCellSurface, type GridCellKeyFilter } from '../useGridCellSurface';

// Greenfield grid-celle-basis (§2.5/§3.5): den ENE tynde `<input>`-skal for en persisteret grid-celle, oven på
// `useGridCellSurface` (som bro-forbinder grid-core-navigation ↔ greenfield-editor-motor). Den er grid-pendanten
// til `GreenfieldNumericTextField`/`StyledTextFieldBase`, men med den kompakte tabel-InputBase-styling fra
// `tableInputStyles`. Familie-skallerne (beløb/heltal/år/uge/dato) leverer kun deres tegnfilter + adornment +
// justering; parse/format/paste og commit-intervaller ejes af descriptorens codec + feltvalidatorer (§2.4).

export type GreenfieldGridTextCellProps<T, TEntity = unknown> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<T, TEntity>;
  /** Familiespecifikt tegnfilter i åben editor (fx `filterIntegerKeyDown`). */
  keyFilter?: GridCellKeyFilter;
  placeholder?: string;
  textAlign?: 'center' | 'right' | 'left';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Enheds-/udtryks-adornment. En funktion modtager draftens tomhed + den committede værdi. */
  endAdornment?:
    | React.ReactNode
    | ((info: Readonly<{ isDraftEmpty: boolean; value: T | undefined }>) => React.ReactNode);
  /** Ekstra absolut-positioneret overlay i cellen (fx et `fx`-udtryksmærke). Render-prop får den committede værdi. */
  overlay?:
    | React.ReactNode
    | ((info: Readonly<{ value: T | undefined }>) => React.ReactNode);
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const GreenfieldGridTextCellInner = <T, TEntity>(
  {
    gridCell,
    cell,
    keyFilter,
    placeholder,
    textAlign = 'center',
    inputMode = 'text',
    endAdornment,
    overlay,
    inputRef,
    sx,
  }: GreenfieldGridTextCellProps<T, TEntity>
): React.ReactElement => {
  const gridApi = useGridCoreApi();
  const surface = useGridCellSurface<T, TEntity>(gridCell, cell, { keyFilter });

  const assignInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      assignRef(surface.inputElementRef, node);
      assignRef(inputRef, node);
    },
    [inputRef, surface.inputElementRef]
  );

  const hasError = surface.issue !== undefined;
  const showError = hasError && !surface.isEditing;
  const errorMessage = surface.issue?.message ?? '';

  const isDraftEmpty = surface.displayText.trim() === '';
  const resolvedEndAdornment = typeof endAdornment === 'function'
    ? (endAdornment as (info: Readonly<{ isDraftEmpty: boolean; value: T | undefined }>) => React.ReactNode)(
        { isDraftEmpty, value: surface.value }
      )
    : endAdornment;

  // Klik uden for selve <input> (på adornment/padding) skal fokusere inputtet, så grid-core-aktiveringen kan
  // åbne editoren — ligesom et klik direkte på inputtet.
  const inputEl = surface.inputElementRef;
  const handleFieldMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === inputEl.current) return;
      e.preventDefault();
      inputEl.current?.focus();
    },
    [inputEl]
  );

  return (
    <Box sx={mergeSx({ position: 'relative', width: '100%', height: '100%' }, sx)}>
      <Tooltip title={showError ? errorMessage : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%' }}>
          <InputBase
            inputRef={assignInputRef}
            autoComplete="off"
            value={surface.displayText}
            readOnly={surface.readOnly}
            onChange={(e) => surface.onDraftChange(e.target.value)}
            onBlur={() => surface.controller.settle()}
            onKeyDown={surface.onKeyDown}
            onPaste={surface.onPaste}
            onMouseDown={handleFieldMouseDown}
            {...(resolvedEndAdornment === undefined ? {} : { endAdornment: resolvedEndAdornment })}
            placeholder={surface.isFocused && !surface.readOnly ? '' : placeholder}
            inputProps={{
              inputMode,
              readOnly: surface.readOnly,
            }}
            sx={{
              ...getTableInputRootStyles({ showError, tableKind: gridApi.tableKind, locked: false }),
              cursor: surface.isEditing ? 'text' : 'pointer',
              ...(surface.isFocused ? { outline: 'none' } : {}),
              '& .MuiInputBase-input': {
                ...getTableInputElementStyles({
                  textAlign,
                  cursor: surface.isEditing ? 'text' : 'pointer',
                  caretColor: surface.isEditing ? 'auto' : 'transparent',
                }),
              },
            }}
          />
          {showError ? <span style={visuallyHiddenStyle}>{errorMessage}</span> : null}
          {typeof overlay === 'function'
            ? (overlay as (info: Readonly<{ value: T | undefined }>) => React.ReactNode)({ value: surface.value })
            : overlay}
        </Box>
      </Tooltip>
    </Box>
  );
};

// forwardRef bevarer den generiske `T` via en cast af den generiske inner-komponent.
const GreenfieldGridTextCell = GreenfieldGridTextCellInner as <T, TEntity = unknown>(
  props: GreenfieldGridTextCellProps<T, TEntity>
) => React.ReactElement;

export default GreenfieldGridTextCell;

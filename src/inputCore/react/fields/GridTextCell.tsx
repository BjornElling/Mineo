import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../../utils/mergeSx';
import { visuallyHiddenStyle } from '../../../components/shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './gridCellStyles';
import { useGridCoreApi } from '../../../components/tables/useGridCore';
import { assignRef } from '../../../utils/refUtils';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import type { CellSpec } from '../useCellEditor';
import type { FieldIssue } from '../../inputIssue';
import type { FieldWarning } from '../../fieldWarning';
import { useGridCellSurface, type GridCellKeyFilter } from '../useGridCellSurface';
import { resolveFieldIssueText } from '../fieldIssueText';

// Grid-celle-basis (§2.5/§3.5): den ENE tynde `<input>`-skal for en persisteret grid-celle, oven på
// `useGridCellSurface` (som bro-forbinder grid-core-navigation ↔ editor-motoren). Den er grid-pendanten
// til `NumericTextField`/`StyledTextFieldBase`, men med den kompakte tabel-InputBase-styling fra
// `tableInputStyles`. Familie-skallerne (beløb/heltal/år/uge/dato) leverer kun deres tegnfilter + adornment +
// justering; parse/format/paste og commit-intervaller ejes af descriptorens codec + feltvalidatorer (§2.4).

export type GridTextCellProps<T, TEntity = unknown> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<T, TEntity>;
  /** Familiespecifikt tegnfilter i åben editor (fx `filterIntegerKeyDown`). */
  keyFilter?: GridCellKeyFilter;
  /**
   * Et COLLECTION-afledt feltissue på cellen: en kryds-række-domæneregel (dublet-datoer, identiske
   * afgørelser), som en descriptor-validator ikke kan udtrykke, fordi den kun ser sin egen celles værdi.
   *
   * Det er et rigtigt `FieldIssue` med feltadresse — ikke en fri fejltekst — så rød markering,
   * tooltip, fokusnavigation og consumerblokering læser én og samme repræsentation. Descriptorens eget
   * issue (format/bounds/rule) har forrang (§1.8: den mest direkte fejl vises).
   */
  collectionRuleIssue?: FieldIssue;
  /** Ikke-blokerende gul cellemarkering. En aktiv rød fejl har forrang. */
  warning?: FieldWarning;
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

const GridTextCellInner = <T, TEntity>(
  {
    gridCell,
    cell,
    keyFilter,
    collectionRuleIssue,
    warning,
    placeholder,
    textAlign = 'center',
    inputMode = 'text',
    endAdornment,
    overlay,
    inputRef,
    sx,
  }: GridTextCellProps<T, TEntity>
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

  // Descriptorens eget issue har forrang; en ekstern kryds-række-fejl vises kun, når cellen ikke selv har et
  // format-/bounds-/rule-issue (§1.8: højst én aktiv rød fejl + én tooltip; den mest direkte vælges).
  const issueText = resolveFieldIssueText(surface.issue, collectionRuleIssue);
  const showError = issueText.message !== undefined;
  const normalizedWarningText = warning?.message.trim() ?? '';
  const showWarning = !showError && normalizedWarningText !== '';
  const errorMessage = issueText.message ?? '';
  const tooltipMessage = issueText.tooltip ?? '';

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
      <Tooltip title={showError ? tooltipMessage : showWarning ? normalizedWarningText : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%' }}>
          <InputBase
            inputRef={assignInputRef}
            autoComplete="off"
            value={surface.displayText}
            readOnly={surface.readOnly}
            onChange={(e) => surface.onDraftChange(e.target.value)}
            onBlur={surface.onBlur}
            onKeyDown={surface.onKeyDown}
            onPaste={surface.onPaste}
            onMouseDown={handleFieldMouseDown}
            {...(resolvedEndAdornment === undefined ? {} : { endAdornment: resolvedEndAdornment })}
            placeholder={surface.isFocused && !surface.readOnly ? '' : placeholder}
            inputProps={{
              inputMode,
              readOnly: surface.readOnly,
              'aria-invalid': showError,
              ...surface.restoreTargetAttributes,
            }}
            sx={{
              ...getTableInputRootStyles({ showError, showWarning, tableKind: gridApi.tableKind, locked: false }),
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
          {showWarning ? <span style={visuallyHiddenStyle}>{normalizedWarningText}</span> : null}
          {typeof overlay === 'function'
            ? (overlay as (info: Readonly<{ value: T | undefined }>) => React.ReactNode)({ value: surface.value })
            : overlay}
        </Box>
      </Tooltip>
    </Box>
  );
};

// forwardRef bevarer den generiske `T` via en cast af den generiske inner-komponent.
const GridTextCell = GridTextCellInner as <T, TEntity = unknown>(
  props: GridTextCellProps<T, TEntity>
) => React.ReactElement;

export default GridTextCell;

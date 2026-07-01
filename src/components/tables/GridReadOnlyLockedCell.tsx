import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { assignRef } from '../../utils/refUtils';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';
import { useGridCoreApi } from './useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from './gridCore/gridCoreTypes';
import { gridCellKey } from './gridCore/gridCoreUtils';

export const GridReadOnlyLockedCell = React.memo(
  ({
    gridCell,
    displayValue,
    align,
    errorMessage,
    infoTooltipText,
    placeholder,
    inputRef,
    sx,
  }: {
    gridCell: GridCellCoord;
    displayValue: string;
    align: 'center' | 'right';
    errorMessage?: string;
    infoTooltipText?: string;
    placeholder?: string;
    inputRef?: React.Ref<HTMLInputElement>;
    sx?: SxProps<Theme>;
  }) => {
    const grid = useGridCoreApi();
    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const showError = Boolean(errorMessage && errorMessage.trim() !== '');
    const tooltipText = showError ? (errorMessage ?? '') : (infoTooltipText ?? '');

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => true,
        // Locked: intet at committe, men handle-kontrakten kræver true (= "ingen pending commit").
        commitCurrent: () => true,
        clearAndCommit: () => {
          // Locked: no-op
        },
        cancelEdit: () => {
          grid.closeEditing();
        },
        prepareEditFromKey: () => false,
        selectAll: () => {
          // no-op
        },
      };
    }, [grid]);

    React.useEffect(() => {
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    }, [editorHandle, grid, gridCell]);

    const a11yErrorId = React.useId();
    const a11yInputId = React.useId();
    const htmlInputName = gridCellKey(gridCell);

    return (
      <Tooltip title={tooltipText} arrow placement="top" disableHoverListener={tooltipText.trim() === ''}>
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            value={displayValue}
            readOnly
            inputProps={{
              id: a11yInputId,
              name: htmlInputName,
              readOnly: true,
              inputMode: 'text',
              // Ikke-fokuserbar: skrivebeskyttede spejl-/afledte celler skal opføre sig som de plain-text
              // read-only celler i andre tabeller (fx "Samlet Løn"). tabindex=-1 tager den ud af browser-Tab
              // OG af TABLE_FOCUSABLE_SELECTOR (grid-navigation), og onMouseDown-preventDefault forhindrer
              // klik-fokus. Grid-nav springer i forvejen låste celler over (getIsLocked).
              tabIndex: -1,
              onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => e.preventDefault(),
              'data-mineo-grid-locked': 'true',
              'aria-describedby': showError ? a11yErrorId : undefined,
            }}
            placeholder={placeholder ?? ''}
            sx={{
              width: '100%',
              height: '100%',
              font: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
              color: 'inherit',
              fontFeatureSettings: '"tnum"',
              paddingLeft: '8px',
              paddingRight: '8px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: showError ? 'var(--color-input-border-error)' : 'transparent',
              '& .MuiInputBase-input': {
                font: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'var(--mineo-color-grid-derived)',
                textAlign: align,
                cursor: 'default',
                caretColor: 'transparent',
              },
              ...sx,
            }}
          />
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {errorMessage}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

GridReadOnlyLockedCell.displayName = 'GridReadOnlyLockedCell';

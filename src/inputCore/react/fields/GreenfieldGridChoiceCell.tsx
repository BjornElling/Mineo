import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../../utils/mergeSx';
import StyledDropdown, { type StyledDropdownChangeEvent, type StyledDropdownValue } from '../../../components/inputs/StyledDropdown';
import { useGridCoreApi } from '../../../components/tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCore/gridCoreTypes';
import { gridCellKey } from '../../../components/tables/gridCore/gridCoreUtils';
import { TABLE_INPUT_HEIGHT, TABLE_INPUT_PADDING_Y } from '../../../components/inputs/table/tableInputStyles';
import { useCellEditor, type CellSpec } from '../useCellEditor';

// Greenfield grid dropdown-celle (§2.5/§3.6): et immediate-commit-valg i en grid-celle. Den er grid-pendanten til
// `GreenfieldChoiceField` (form-dropdown) og erstatter legacy `TableDropdown` for celle-valg (fx rentekrav-enhed).
// Menuvalget committer STRAKS gennem `useCellEditor().commitImmediate` — der er aldrig en åben draft at settle, så
// grid-core-navigationens `commitCurrent` er altid en no-op-success. Den viste værdi + røde issue læses fra den
// afsluttede revision gennem controlleren; der er ingen konkurrerende celle-værdikopi (§3.8).
//
// Visuelt bruger den `StyledDropdown` i "loose"-tabellernes outlined stil (samme som `TableDropdown`s loose-gren),
// så udseendet er 1:1 med legacy i de MUI-baserede løse tabeller.

const TABLE_DROPDOWN_TEXT_PADDING_LEFT = '14px';

export type GreenfieldGridChoiceCellProps<TValue extends StyledDropdownValue, TEntity = unknown> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<TValue | undefined, TEntity>;
  children?: React.ReactNode;
  /** Tilgængeligt navn på combobox'en (axe: formularelementer skal have etiketter). */
  ariaLabel?: string;
  /**
   * Om det tomme placeholder-valg tilbydes (default sandt). Sæt `false` for et påkrævet valg med gyldig default
   * (fx rentekrav-enhed='dage'): så vises ingen tom-række, og cellen kan ikke ryddes til placeholderen. Feltets
   * faktiske tomhed ejes af descriptorens `isEmpty`; denne prop styrer kun UI'et.
   */
  allowEmpty?: boolean;
  placeholder?: string;
  sx?: SxProps<Theme>;
}>;

const GreenfieldGridChoiceCellInner = <TValue extends StyledDropdownValue, TEntity>(
  { gridCell, cell, children, ariaLabel, allowEmpty = true, placeholder, sx }: GreenfieldGridChoiceCellProps<TValue, TEntity>
): React.ReactElement => {
  const gridApi = useGridCoreApi();
  const controller = useCellEditor<TValue | undefined, TEntity>(cell);

  const hasError = controller.issue !== undefined;
  const errorMessage = controller.issue?.message ?? '';

  // En ikke-oprettet placeholder-række kan ikke "ryddes" (der er intet felt at rydde); et tom-valg dér er derfor
  // no-op. Et ikke-tomt valg promoverer rækken atomisk via `commitImmediate`'s placeholder-override (§1.11).
  const isPlaceholder = cell.kind === 'placeholder';
  const latest = React.useRef({ controller, allowEmpty, isPlaceholder });
  latest.current = { controller, allowEmpty, isPlaceholder };

  const handleChange = React.useCallback((e: StyledDropdownChangeEvent<TValue | undefined>) => {
    const next = e.target.value;
    if (next === undefined) {
      // Tom-valg rydder et EKSISTERENDE felt; på en placeholder er der intet at rydde (no-op).
      if (!latest.current.isPlaceholder) latest.current.controller.clearImmediate();
      return;
    }
    latest.current.controller.commitImmediate(next);
  }, []);

  // Grid-core editor-handle: et menuvalg er instant-commit, så der er intet uafsluttet commit ved navigation.
  const editorHandle = React.useMemo<GridCellEditorHandle>(() => ({
    getElement: () => null,
    getIsLocked: () => false,
    commitCurrent: () => true,
    clearAndCommit: () => {
      if (latest.current.isPlaceholder || !latest.current.allowEmpty) return;
      latest.current.controller.clearImmediate();
    },
    cancelEdit: () => {
      gridApi.closeEditing();
    },
    prepareEditFromKey: () => false,
    selectAll: () => {
      // no-op for dropdown
    },
  }), [gridApi]);

  const resolvedGridCellKey = gridCellKey(gridCell);
  React.useEffect(() => {
    gridApi.registerEditor(gridCell, editorHandle);
    return () => {
      gridApi.unregisterEditor(gridCell);
    };
    // resolvedGridCellKey er den stabile streng-repræsentation af gridCell; gridCell udelades bevidst (inline
    // object literal i kalderen = ny reference, samme værdi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHandle, gridApi, resolvedGridCellKey]);

  const looseDropdownSx: SxProps<Theme> = mergeSx({
    width: '100%',
    height: TABLE_INPUT_HEIGHT,
    boxSizing: 'border-box',
    fontSize: '13px',
    fontFamily: '"Montserrat", sans-serif',
    color: 'inherit',
    fontFeatureSettings: '"tnum"',
    '& .MuiInputBase-input': {
      font: 'inherit',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      color: 'inherit',
      paddingTop: TABLE_INPUT_PADDING_Y,
      paddingBottom: TABLE_INPUT_PADDING_Y,
      paddingLeft: TABLE_DROPDOWN_TEXT_PADDING_LEFT,
      userSelect: 'text',
      WebkitUserSelect: 'text',
    },
  }, sx);

  if (!allowEmpty) {
    const value = controller.value;
    if (value === undefined) {
      throw new Error('GreenfieldGridChoiceCell: allowEmpty=false kræver en defineret værdi');
    }
    return (
      <StyledDropdown<TValue>
        name={resolvedGridCellKey}
        inputProps={{ 'aria-label': ariaLabel }}
        width="100%"
        value={value}
        allowEmpty={false}
        onChange={handleChange}
        error={hasError}
        helperText={errorMessage}
        sx={looseDropdownSx}
      >
        {children}
      </StyledDropdown>
    );
  }

  return (
    <StyledDropdown<TValue>
      name={resolvedGridCellKey}
      inputProps={{ 'aria-label': ariaLabel }}
      width="100%"
      value={controller.value === undefined ? undefined : controller.value}
      allowEmpty
      placeholder={placeholder}
      onChange={handleChange}
      error={hasError}
      helperText={errorMessage}
      sx={looseDropdownSx}
    >
      {children}
    </StyledDropdown>
  );
};

// forwardRef-fri generisk komponent (dropdownen eksponerer intet imperativt input-element).
const GreenfieldGridChoiceCell = GreenfieldGridChoiceCellInner as <TValue extends StyledDropdownValue, TEntity = unknown>(
  props: GreenfieldGridChoiceCellProps<TValue, TEntity>
) => React.ReactElement;

export default GreenfieldGridChoiceCell;

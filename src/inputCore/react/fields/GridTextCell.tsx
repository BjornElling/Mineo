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
import { useGridCellSurface } from '../useGridCellSurface';
import { useFieldLabel } from '../useFieldLabel';
import { keyFilterFromAdmission, type DraftAdmission } from '../../../components/inputs/draftAdmission';
import { resolveFieldIssueText } from '../fieldIssueText';

// Grid-celle-basis (§2.5/§3.5): den ENE tynde `<input>`-skal for en persisteret grid-celle, oven på
// `useGridCellSurface` (som bro-forbinder grid-core-navigation ↔ editor-motoren). Den er grid-pendanten
// til `NumericTextField`/`StyledTextFieldBase`, men med den kompakte tabel-InputBase-styling fra
// `tableInputStyles`. Familie-skallerne (beløb/heltal/år/uge/dato) leverer kun deres tegnfilter + adornment +
// justering; parse/format/paste og commit-intervaller ejes af descriptorens codec + feltvalidatorer (§2.4).

export type GridTextCellProps<T, TEntity = unknown> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<T, TEntity>;
  /**
   * Familiens tegn- og længdeprædikat (fx `integerAdmission({ allowNegative })`). ÉN erklæring pr.
   * cellefamilie: surfacen håndhæver det i `onDraftChange` (modalitets-uafhængigt, §1.2) og afleder
   * keydown-filteret af det SAMME prædikat. Se `draftAdmission.ts`.
   */
  admission?: DraftAdmission;
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
  /** Maksimal rå draftlængde, når feltets synlige form har en fast længde. */
  maxDraftLength?: number;
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
    admission,
    collectionRuleIssue,
    warning,
    placeholder,
    textAlign = 'center',
    inputMode = 'text',
    maxDraftLength,
    endAdornment,
    overlay,
    inputRef,
    sx,
  }: GridTextCellProps<T, TEntity>
): React.ReactElement => {
  const gridApi = useGridCoreApi();
  // Feltnavnet kommer fra den ENE autoritet — `InputReader.labelOf` — præcis som formularfelterne.
  // Cellen læste før `descriptor.label` direkte og gik dermed uden om feltets `contextualLabel`, så et
  // felt med et kontekstafhængigt navn ville hedde én ting i formularen og en anden i tabellen. Det er
  // netop den drift, `useFieldLabel` blev oprettet for at fjerne (§3.2a).
  const accessibleName = useFieldLabel(cell.field);
  const cellStatusId = React.useId();
  const keyFilter = React.useMemo(
    () => (admission === undefined ? undefined : keyFilterFromAdmission(admission)),
    [admission]
  );
  const surface = useGridCellSurface<T, TEntity>(gridCell, cell, {
    ...(keyFilter === undefined ? {} : { keyFilter }),
    ...(admission === undefined ? {} : { draftAdmission: admission }),
    ...(maxDraftLength === undefined ? {} : { maxDraftLength }),
  });

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
              'aria-label': accessibleName,
              inputMode,
              ...(maxDraftLength === undefined ? {} : { maxLength: maxDraftLength }),
              readOnly: surface.readOnly,
              'aria-invalid': showError,
              // Den skjulte fejl-/advarselstekst nedenfor skal PEGES på, ellers er den en løsrevet
              // node, ingen skærmlæser kobler til cellen. Formularfeltet gjorde det allerede
              // (`StyledTextFieldBase`); cellen renderede teksten uden id og uden describedby, så en
              // skærmlæserbruger kun fik den røde ramme og aldrig beskeden.
              ...(showError || showWarning ? { 'aria-describedby': cellStatusId } : {}),
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
                '&::placeholder': {
                  color: 'var(--mineo-color-active-grid-placeholder)',
                  opacity: 1,
                },
              },
            }}
          />
          {showError || showWarning ? (
            <span id={cellStatusId} style={visuallyHiddenStyle}>
              {showError ? errorMessage : normalizedWarningText}
            </span>
          ) : null}
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

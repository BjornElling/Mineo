import * as React from 'react';
import { Divider, MenuItem, Select, Tooltip, type SelectChangeEvent } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { assignRef } from '../../../utils/refUtils';
import { copyTextToClipboard, readClipboardText } from '../../../utils/clipboardUtils';
import { useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCore/gridCoreTypes';
import { gridCellKey } from '../../tables/gridCore/gridCoreUtils';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../StyledDropdown';
import { findTypeaheadMatchIndex, isClearKey, isTypeaheadCharKey } from '../dropdownInteractionCore';
import { getTableInputBorderAppearance, TABLE_INPUT_HEIGHT, TABLE_INPUT_PADDING_Y } from './tableInputStyles';

/**
 * TableDropdown (tabelcelle-select)
 *
 * Tværgående navigations-kontrakt:
 * - Wrapperen sætter `data-mineo-table-dropdown="true"`, så tabellens keyboard-navigation kan registrere denne widget.
 * - `src/components/tables/tableKeyboardNavigation.ts` har en special-case:
 *     - Enter på en TableDropdown skal åbne menuen (udløs IKKE Enter-navigation på tabel-niveau).
 * - Denne komponent må IKKE intercepte Tab; Tab håndteres af navigation på tabel- eller container-niveau.
 * - Vi intercepter kun Delete/Backspace (når allowEmpty) for at rydde valget, og kun når menuen er lukket.
 *
 * Hvis du ændrer wrapper-attributten eller key handling, så gennemgå også `tableKeyboardNavigation.ts`.
 */
export type TableDropdownValueOption = Readonly<{
  value: string;
  label: string;
  /**
   * Når sand, kan optionen ikke vælges (vises stadig i listen). Bruges fx når en
   * anden indstilling et andet sted i UI'et tager funktionen som denne option dækker.
   */
  disabled?: boolean;
  /**
   * Tooltip-tekst der vises når brugeren holder over en disabled option.
   * Kun relevant når `disabled` er `true`.
   */
  disabledReason?: string;
}>;
export type TableDropdownDividerOption = Readonly<{ kind: 'divider'; id: string }>;
export type TableDropdownOption = TableDropdownValueOption | TableDropdownDividerOption;

export type TableDropdownChangeEvent = Readonly<{ target: { value: string } }>;

type TableDropdownPropsAllowEmpty = Readonly<{
  allowEmpty?: true;
  value?: string;
  placeholder?: string;
}>;

type TableDropdownPropsNoEmpty = Readonly<{
  allowEmpty: false;
  value: string;
  placeholder?: never;
}>;

export type TableDropdownProps = (TableDropdownPropsAllowEmpty | TableDropdownPropsNoEmpty) &
  Readonly<{
    gridCell?: GridCellCoord;
    undoFieldPathAliases?: readonly string[];
    readOnly?: boolean;
    /**
     * Visuel stil-variant.
     *
     * - `grid`: kompakt/fladt udseende beregnet til HTML-grid-tabeller.
     * - `loose`: outlined udseende der matcher `Styled*Field`-inputs (brugt i MUI "loose"-tabeller).
     */
    appearance?: 'grid' | 'loose';
    options: readonly TableDropdownOption[];
    onChange?: (e: TableDropdownChangeEvent) => void;
    onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
    externalErrorMessage?: string;
    inputRef?: React.Ref<HTMLElement>;
    sx?: SxProps<Theme>;
  }>;

const TABLE_DROPDOWN_TEXT_PADDING_LEFT = '14px';
const TABLE_DROPDOWN_RESERVED_ICON_WIDTH = '24px';

const TableDropdown = React.memo(
  ({
    gridCell,
    undoFieldPathAliases = [],
    value,
    readOnly = false,
    appearance = 'grid',
    placeholder = 'Vælg...',
    options,
    onChange,
    onBlur,
    externalErrorMessage,
    inputRef,
    sx,
    ...rest
  }: TableDropdownProps) => {
    const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const suppressNextClickOpenRef = React.useRef(false);

    const hasTextSelectionWithinWrapper = React.useCallback((): boolean => {
      const host = wrapperRef.current;
      if (!host) return false;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

      try {
        const range = selection.getRangeAt(0);
        return host.contains(range.commonAncestorContainer);
      } catch {
        return false;
      }
    }, []);

    const getTriggerAndListbox = React.useCallback((): { trigger: HTMLElement | null; listbox: HTMLElement | null } => {
      const host = wrapperRef.current;
      const trigger = host?.querySelector('[role="combobox"]') as HTMLElement | null;
      const controlsId = trigger?.getAttribute('aria-controls') ?? null;
      const listbox = controlsId ? document.getElementById(controlsId) : null;
      return { trigger, listbox: listbox instanceof HTMLElement ? listbox : null };
    }, []);

    const ensureMenuKeyboardFocus = React.useCallback((fromNode?: Element | null) => {
      const fromNodeListbox = fromNode instanceof Element
        ? (fromNode.querySelector('[role="listbox"]') as HTMLElement | null)
        : null;
      const { listbox: triggerListbox } = getTriggerAndListbox();
      const listbox = fromNodeListbox ?? triggerListbox;
      if (!listbox) return;

      const selectedOption = listbox.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const tabbableOption = listbox.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
      const firstOption = listbox.querySelector<HTMLElement>('[role="option"]');
      const target = tabbableOption ?? selectedOption ?? firstOption ?? listbox;

      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }, [getTriggerAndListbox]);

    const grid = useGridCoreApi();
    const menuHighlightColor = 'var(--color-active-bg)';
    const { isLooseTable, borderRadius: inputBorderRadius, borderColor: inputBorderColor } = getTableInputBorderAppearance(grid.tableKind);
    const resolvedAppearance = appearance === 'grid' ? (isLooseTable ? 'loose' : 'grid') : appearance;
    const allowEmpty: boolean = (rest as Readonly<{ allowEmpty?: boolean }>).allowEmpty ?? true;

    if (import.meta.env.DEV && allowEmpty === false && (value === undefined || value.trim() === '')) {
      throw new Error('TableDropdown: value is required when allowEmpty=false');
    }

    const isDividerOption = React.useCallback((option: TableDropdownOption): option is TableDropdownDividerOption => {
      return 'kind' in option && option.kind === 'divider';
    }, []);

    /**
     * Render af én value-option som direkte MenuItem, fælles for grid- og loose-varianter.
     * MUI Select kræver at value-options ligger som direkte MenuItem-children; wrapper vi en
     * disabled option i fx Tooltip/span, tæller MUI ikke værdien som tilgængelig og advarer
     * fejlagtigt om out-of-range value for eksisterende rækker.
     */
    const renderValueOptionMenuItem = React.useCallback((opt: TableDropdownValueOption) => {
      const disabledReason = opt.disabled ? opt.disabledReason : undefined;
      return (
        <MenuItem
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
          title={disabledReason}
          aria-label={disabledReason ? `${opt.label}. ${disabledReason}` : opt.label}
        >
          {opt.label}
        </MenuItem>
      );
    }, []);

    const handleChange = React.useCallback(
      (event: SelectChangeEvent<string>) => {
        if (readOnly) return;
        onChange?.({ target: { value: event.target.value } });
      },
      [onChange, readOnly]
    );

    const openMenu = React.useCallback(() => {
      if (readOnly) return;
      setOpen(true);
    }, [readOnly]);

    const closeMenu = React.useCallback(() => {
      setOpen(false);
    }, []);

    const handleTriggerClick = React.useCallback(() => {
      if (suppressNextClickOpenRef.current) {
        suppressNextClickOpenRef.current = false;
        return;
      }
      if (hasTextSelectionWithinWrapper()) return;
      openMenu();
    }, [hasTextSelectionWithinWrapper, openMenu]);

    const handleTriggerMouseUp = React.useCallback(() => {
      suppressNextClickOpenRef.current = hasTextSelectionWithinWrapper();
    }, [hasTextSelectionWithinWrapper]);

    const handleTriggerKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (readOnly) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        openMenu();
      },
      [openMenu, readOnly]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (readOnly) return;

        const activeEl = (e.target instanceof HTMLElement ? e.target : null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const expandedHost = activeEl?.closest('[aria-expanded]') as HTMLElement | null;
        const expanded = expandedHost?.getAttribute('aria-expanded') === 'true';
        if (expanded) return;

        if (isClearKey(e)) {
          // I tabel-kontekst håndteres Delete normalt først på table-capture-niveau.
          // Behold dette som en defensiv fallback til isoleret brug uden for tabel.
          if (!allowEmpty) return;
          e.preventDefault();
          e.stopPropagation();
          onChange?.({ target: { value: '' } });
          return;
        }

        if (!isTypeaheadCharKey(e)) return;
        const trimmedKey = e.key.trim();

        // Tom streng for ikke-matchbare pladser (dividers/disabled), så den delte typeahead-kerne
        // springer dem over — parallelt til StyledDropdowns visualOptionLabels.
        const labels = options.map((opt) =>
          isDividerOption(opt) || opt.disabled ? '' : opt.label
        );
        const currentIndex = typeof value === 'string'
          ? options.findIndex((opt) => !isDividerOption(opt) && opt.value === value)
          : -1;
        const nextIndex = findTypeaheadMatchIndex(labels, trimmedKey, currentIndex);
        if (nextIndex < 0) return;

        const nextOption = options[nextIndex];
        if (!nextOption || isDividerOption(nextOption)) return;
        const nextValue = nextOption.value;
        if (typeof nextValue !== 'string') return;

        e.preventDefault();
        e.stopPropagation();
        onChange?.({ target: { value: nextValue } });
      },
      [allowEmpty, isDividerOption, onChange, options, readOnly, value]
    );

    const selectedLabel = React.useMemo(() => {
      const selectedOption = options.find((opt) => !isDividerOption(opt) && opt.value === (value ?? ''));
      return selectedOption && !isDividerOption(selectedOption) ? selectedOption.label : '';
    }, [isDividerOption, options, value]);

    const handleWrapperRef = React.useCallback(
      (el: HTMLSpanElement | null) => {
        wrapperRef.current = el;
        assignRef(inputRef, el);
      },
      [inputRef]
    );

    const findValueByExactLabel = React.useCallback(
      (label: string): string | null => {
        if (allowEmpty && placeholder === label) return '';
        const matched = options.find((opt) => !isDividerOption(opt) && opt.label === label);
        if (!matched || isDividerOption(matched)) return null;
        if (matched.disabled) return null;
        return matched.value;
      },
      [allowEmpty, isDividerOption, options, placeholder]
    );

    const a11yErrorId = React.useId();
    const a11yInputId = React.useId();
    const undoFocusToken = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const showError = externalErrorText !== '';
    const looseDropdownSx: SxProps<Theme> = {
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
      ...sx,
    };

    const handleLooseChange = React.useCallback(
      (e: StyledDropdownChangeEvent<string | undefined>) => {
        const nextValue = e.target.value;
        onChange?.({ target: { value: nextValue === undefined ? '' : String(nextValue) } });
      },
      [onChange]
    );

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => {
          const host = wrapperRef.current;
          if (!host) return null;
          const trigger = host.querySelector('[role="combobox"]');
          return trigger instanceof HTMLElement ? trigger : host;
        },
        getIsLocked: () => readOnly,
        // Instant-commit-kontrol: et menuvalg committer straks via onChange, så der er aldrig en
        // pending draft at committe ved navigation. true = "intet uafsluttet commit blokerer".
        commitCurrent: () => true,
        clearAndCommit: () => {
          if (readOnly || !allowEmpty) return;
          onChange?.({ target: { value: '' } });
        },
        cancelEdit: () => {
          grid.closeEditing();
        },
        prepareEditFromKey: () => false,
        selectAll: () => {
          // no-op for dropdown
        },
      };
    }, [allowEmpty, grid, onChange, readOnly]);

    // Ét sandt sted for celle-nøgleformatet: den kanoniske `gridCellKey`-util (samme util som
    // tekst-celle-kernen og editor-registret i useGridCoreController bruger). Lokal null-gren fordi
    // `gridCell` her er valgfri (util'en kræver en koordinat). Re-derivér IKKE `rowId:colIndex` inline.
    const resolvedGridCellKey = gridCell ? gridCellKey(gridCell) : null;
    const undoFieldPathAliasesAttr = undoFieldPathAliases.length > 0 ? undoFieldPathAliases.join(' ') : undefined;
    React.useEffect(() => {
      if (!gridCell) return;
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    // resolvedGridCellKey er en stabil streng-repræsentation af gridCell-koordinaterne.
    // gridCell er intentionelt udeladt fra dep-arrayet for at undgå re-registrering
    // ved inline object literals i caller (ny reference, samme værdier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorHandle, grid, resolvedGridCellKey]);

    return (
      <Tooltip title={showError ? externalErrorText : ''} arrow placement="top">
        <span
          data-mineo-table-dropdown="true"
          style={{ display: 'block' }}
          onKeyDownCapture={handleKeyDown}
          onCopyCapture={(e) => {
            if (hasTextSelectionWithinWrapper()) return;
            copyTextToClipboard(e, { value: selectedLabel });
          }}
          onPasteCapture={(e) => {
            if (readOnly) return;
            const nextValue = findValueByExactLabel(readClipboardText(e));
            e.preventDefault();
            e.stopPropagation();
            if (nextValue === null) return;
            onChange?.({ target: { value: nextValue } });
          }}
          ref={handleWrapperRef}
        >
          {resolvedAppearance === 'loose' ? (
            allowEmpty ? (
              <StyledDropdown
                name={resolvedGridCellKey ?? undefined}
                inputProps={{ 'data-mineo-undo-field-path-aliases': undoFieldPathAliasesAttr }}
                width="100%"
                value={(value ?? '') === '' ? undefined : value}
                allowEmpty
                placeholder={placeholder}
                onChange={handleLooseChange}
                onBlur={onBlur}
                error={showError}
                helperText={externalErrorText}
                sx={looseDropdownSx}
              >
                {options.map((opt) => {
                  if (isDividerOption(opt)) {
                    return <StyledDropdown.Divider key={opt.id} />;
                  }
                  return renderValueOptionMenuItem(opt);
                })}
              </StyledDropdown>
            ) : (
              <StyledDropdown
                name={resolvedGridCellKey ?? undefined}
                inputProps={{ 'data-mineo-undo-field-path-aliases': undoFieldPathAliasesAttr }}
                width="100%"
                value={value ?? ''}
                allowEmpty={false}
                onChange={handleLooseChange}
                onBlur={onBlur}
                error={showError}
                helperText={externalErrorText}
                sx={looseDropdownSx}
              >
                {options.map((opt) => {
                  if (isDividerOption(opt)) {
                    return <StyledDropdown.Divider key={opt.id} />;
                  }
                  return renderValueOptionMenuItem(opt);
                })}
              </StyledDropdown>
            )
          ) : (
            <Select
              id={a11yInputId}
              name={resolvedGridCellKey ?? undefined}
              open={open}
              value={value ?? ''}
              onChange={handleChange}
              onBlur={onBlur}
              onClose={closeMenu}
              MenuProps={{
                variant: 'selectedMenu',
                // Hold fokus væk fra Menu paper/root; fokus sættes eksplicit i `onEntered`.
                autoFocus: false,
                disableAutoFocusItem: false,
                slotProps: {
                  transition: {
                    onEntered: (enteredNode: unknown) => {
                      const nodeElement = enteredNode instanceof Element ? enteredNode : null;
                      ensureMenuKeyboardFocus(nodeElement);
                      requestAnimationFrame(() => ensureMenuKeyboardFocus(nodeElement));
                    },
                  },
                  paper: {
                    sx: {
                      '& .MuiMenuItem-root.Mui-focusVisible': {
                        backgroundColor: menuHighlightColor,
                      },
                      '& .MuiMenuItem-root.Mui-selected': {
                        backgroundColor: menuHighlightColor,
                      },
                      '& .MuiMenuItem-root.Mui-selected:hover': {
                        backgroundColor: menuHighlightColor,
                      },
                      '& .MuiMenuItem-root:hover': {
                        backgroundColor: menuHighlightColor,
                      },
                    },
                  },
                  list: {
                    autoFocusItem: true,
                  },
                },
              }}
              // Forhindr MUI i at kapre `mousedown`; vi åbner eksplicit fra click-/key-handlere,
              // så tekst i en lukket dropdown kan markeres med musen.
              readOnly
              // Bemærk: MUI Selects key handling varierer efter variant/implementering.
              // Capture-handleren på wrapperen er single source of truth for clear-on-Delete.
              displayEmpty={allowEmpty}
              SelectDisplayProps={{
                onClick: handleTriggerClick,
                onKeyDown: handleTriggerKeyDown,
                onMouseUp: handleTriggerMouseUp,
                // Undo/redo-fokus: bær feltidentiteten på den FOKUSERBARE combobox-trigger
                // (det element tab fokuserer og som tegner den blå ring via :focus-within),
                // ikke på det skjulte native <input>. Ellers fokuserer restore det skjulte
                // input og ringen vises aldrig.
                'data-mineo-undo-focus-token': undoFocusToken,
                'data-mineo-undo-field-path': resolvedGridCellKey ?? undefined,
                'data-mineo-undo-field-path-aliases': undoFieldPathAliasesAttr,
              } as React.HTMLAttributes<HTMLDivElement>}
              size="small"
              variant="standard"
              inputProps={{
                name: resolvedGridCellKey ?? undefined,
                tabIndex: readOnly ? -1 : undefined,
                'aria-describedby': showError ? a11yErrorId : undefined,
              }}
              sx={{
                width: '100%',
                height: TABLE_INPUT_HEIGHT,
                boxSizing: 'border-box',
                fontSize: '13px',
                fontFamily: '"Montserrat", sans-serif',
                color: 'inherit',
                fontFeatureSettings: '"tnum"',
                border: '1px solid',
                borderColor: showError ? 'var(--color-input-border-error)' : inputBorderColor,
                borderRadius: inputBorderRadius,
                paddingTop: TABLE_INPUT_PADDING_Y,
                paddingBottom: TABLE_INPUT_PADDING_Y,
                '&:focus-within': {
                  borderColor: 'var(--color-input-border-focus)',
                },
                '& .MuiSelect-select': {
                  minHeight: 'unset',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: TABLE_DROPDOWN_TEXT_PADDING_LEFT,
                  paddingRight: TABLE_DROPDOWN_RESERVED_ICON_WIDTH,
                  boxSizing: 'border-box',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                },
                '& .MuiInputBase-input': {
                  font: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  color: 'inherit',
                },
                '&:before': { display: 'none' },
                '&:after': { display: 'none' },
                ...sx,
              }}
            >
              {allowEmpty ? (
                <MenuItem value="">
                  <em style={{ color: 'var(--mineo-color-placeholder)' }}>{placeholder}</em>
                </MenuItem>
              ) : null}
              {options.map((opt) => {
                if (isDividerOption(opt)) {
                  return <Divider key={opt.id} component="li" role="separator" />;
                }
                return renderValueOptionMenuItem(opt);
              })}
            </Select>
          )}
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {externalErrorText}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

TableDropdown.displayName = 'TableDropdown';

export default TableDropdown;

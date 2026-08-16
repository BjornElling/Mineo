import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../../utils/mergeSx';
import StyledDropdown, { type StyledDropdownChangeEvent, type StyledDropdownValue } from '../../../components/inputs/StyledDropdown';
import { useGridCoreApi } from '../../../components/tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCore/gridCoreTypes';
import { gridCellKey } from '../../../components/tables/gridCore/gridCoreUtils';
import { getTableInputBorderAppearance, TABLE_INPUT_HEIGHT, TABLE_INPUT_PADDING_Y } from './gridCellStyles';
import { useCellEditor, type CellSpec } from '../useCellEditor';
import type { FieldIssue } from '../../inputIssue';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';
import { resolveFieldIssueText } from '../fieldIssueText';
import { useFieldLabel } from '../useFieldLabel';
import { resolveChoiceAllowEmpty } from './choiceEmptinessPolicy';

// Grid dropdown-celle (§2.5/§3.6): et immediate-commit-valg i en grid-celle. Den er grid-pendanten til
// `ChoiceField` (form-dropdown) og den ene celle-valg-kontrol (fx rentekrav-enhed).
// Menuvalget committer STRAKS gennem `useCellEditor().commitImmediate` — der er aldrig en åben draft at settle, så
// grid-core-navigationens `commitCurrent` er altid en no-op-success. Den viste værdi + røde issue læses fra den
// afsluttede revision gennem controlleren; der er ingen konkurrerende celle-værdikopi (§3.8).
//
// Visuelt følger den samme kantregel som de øvrige grid-celler: almindelige grids har ingen særskilt
// feltkontur, mens løse tabeller beholder formularens afrundede outlined stil.
//
// Tastaturkontrakten er IKKE en egenskab ved denne komponent: både Container og grid-navigationen
// klassificerer den som popup-kontrol ud fra `StyledDropdown`s ARIA-semantik gennem
// `popupWidgetSemantics`, så Enter åbner menuen frem for at flytte cellefokus.

const TABLE_DROPDOWN_TEXT_PADDING_LEFT = '14px';

export type GridChoiceCellProps<
  TValue extends StyledDropdownValue,
  TEntity = unknown,
  TCanonical extends TValue | undefined = TValue | undefined,
> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<TCanonical, TEntity>;
  children?: React.ReactNode;
  /**
   * Tilgængeligt navn på combobox'en, når cellen har et andet navn end feltets egen label.
   * Udelades den, kommer navnet fra feltet selv — se `useFieldLabel`.
   */
  ariaLabel?: string;
  /**
   * Visningstekst for en option, hvis dens children ikke er ren tekst.
   *
   * Skal videreføres: uden den får en option med rig markup den tomme label `''`, og så kan hverken
   * typeahead eller paste matche den. Formularens `ChoiceField` har altid haft proppen; cellen tabte den.
   */
  getOptionLabel?: (value: TValue) => string;
/**
 * Om det tomme placeholder-valg tilbydes.
 *
 * **Udledes af feltets codec.** Et `requiredChoice`-codec HAR en gyldig tomværdi ('dage', 'maaned' …) og
 * kan derfor pr. konstruktion ikke ryddes; et `selection`-codec kan. Reglen stod før som en håndskrevet
 * `allowEmpty={false}` pr. kaldssted, og de to kunne ikke komme fra hinanden på nogen målbar måde: en
 * glemt prop lod brugeren rydde et påkrævet felt med Delete, og fejlen dukkede først op som et kast langt
 * senere. Proppen kan stadig SKÆRPE et valgfrit felt (et domæne, der kræver et valg), men aldrig løsne et
 * påkrævet — det afvises.
 */
  allowEmpty?: boolean;
  placeholder?: string;
  /**
   * Collection-afledt feltissue (fx identiske afgørelser) med rigtig feltadresse — ikke en fri fejltekst
   * Descriptorens eget issue har forrang (§1.8).
   */
  collectionRuleIssue?: FieldIssue;
  sx?: SxProps<Theme>;
}>;

const GridChoiceCellInner = <
  TValue extends StyledDropdownValue,
  TEntity,
  TCanonical extends TValue | undefined,
>(
  { gridCell, cell, children, ariaLabel, getOptionLabel, allowEmpty, placeholder, collectionRuleIssue, sx }: GridChoiceCellProps<TValue, TEntity, TCanonical>
): React.ReactElement => {
  const gridApi = useGridCoreApi();
  const resolvedAllowEmpty = resolveChoiceAllowEmpty(cell.field, allowEmpty, 'GridChoiceCell');
  const controller = useCellEditor<TCanonical, TEntity>(cell);
  const dropdownRootRef = React.useRef<HTMLDivElement>(null);

  // Restore-mål via feltadresse + editorlokation (§3.7): begge cellearter bærer den samme færdigt bundne
  // cellereference, som editoren driver, så fokus efter undo/redo lander på DENNE grid-celles editorlokation.
  const restoreTargetAttributes = useRestoreTargetAttributes(cell.field.address, cell.location);

  // Descriptorens eget issue har forrang; en ekstern kryds-række-fejl vises kun ellers (§1.8).
  const issueText = resolveFieldIssueText(controller.issue, collectionRuleIssue);
  const hasError = issueText.message !== undefined;
  const errorMessage = issueText.message ?? '';
  const tooltipProp = issueText.tooltip === undefined ? {} : { tooltipText: issueText.tooltip };
  // Feltnavnet kommer fra den ENE autoritet — `InputReader.labelOf` — præcis som i formularens
  // `ChoiceField`. Cellen læste før `descriptor.label` direkte og gik uden om feltets `contextualLabel`,
  // så et felt med kontekstafhængigt navn kunne hedde to ting (§3.2a).
  const fieldLabel = useFieldLabel(cell.field);
  const accessibleName = ariaLabel ?? fieldLabel;

  // En ikke-oprettet placeholder-række kan ikke "ryddes" (der er intet felt at rydde); et tom-valg dér er derfor
  // no-op. Et ikke-tomt valg promoverer rækken atomisk via `commitImmediate`'s placeholder-override (§1.11).
  const isPlaceholder = cell.kind === 'placeholder';
  const latest = React.useRef({ controller, allowEmpty: resolvedAllowEmpty, isPlaceholder });
  latest.current = { controller, allowEmpty: resolvedAllowEmpty, isPlaceholder };

  const handleChange = React.useCallback((e: StyledDropdownChangeEvent<TValue | undefined>) => {
    const next = e.target.value;
    if (next === undefined) {
      // Tom-valg rydder et EKSISTERENDE felt; på en placeholder er der intet at rydde (no-op).
      if (!latest.current.isPlaceholder) latest.current.controller.clearImmediate();
      return;
    }
    // Et ikke-tomt dropdownvalg er altid medlem af TValue og dermed af TCanonical's ikke-tomme gren.
    latest.current.controller.commitImmediate(next as TCanonical);
  }, []);

  // Grid-core editor-handle: et menuvalg er instant-commit, så der er intet uafsluttet commit ved navigation.
  const editorHandle = React.useMemo<GridCellEditorHandle>(() => ({
    getElement: () => dropdownRootRef.current?.querySelector<HTMLInputElement>('input[role="combobox"]') ?? null,
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

  const { isLooseTable, borderRadius, borderColor } = getTableInputBorderAppearance(gridApi.tableKind);
  const gridDropdownSx: SxProps<Theme> = mergeSx({
    width: '100%',
    height: TABLE_INPUT_HEIGHT,
    boxSizing: 'border-box',
    borderRadius,
    backgroundColor: isLooseTable ? 'var(--color-input-bg)' : 'transparent',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    color: 'inherit',
    fontFeatureSettings: '"tnum"',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor,
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: isLooseTable ? 'var(--color-input-border-hover)' : borderColor,
    },
    '& .MuiInputBase-input': {
      font: 'inherit',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      color: 'inherit',
      '&::placeholder': {
        color: 'var(--mineo-color-active-grid-placeholder)',
        opacity: 1,
      },
      paddingTop: TABLE_INPUT_PADDING_Y,
      paddingBottom: TABLE_INPUT_PADDING_Y,
      paddingLeft: TABLE_DROPDOWN_TEXT_PADDING_LEFT,
      userSelect: 'text',
      WebkitUserSelect: 'text',
    },
  }, sx);

  if (!resolvedAllowEmpty) {
    const value = controller.value;
    if (value === undefined) {
      throw new Error('GridChoiceCell: allowEmpty=false kræver en defineret værdi');
    }
    return (
      <StyledDropdown<TValue>
        ref={dropdownRootRef}
        ariaLabel={accessibleName}
        name={resolvedGridCellKey}
        restoreTargetAttributes={restoreTargetAttributes}
        width="100%"
        expectedOptionValues={cell.field.descriptor.codec.options}
      {...(getOptionLabel === undefined ? {} : { getOptionLabel })}
        value={value as TValue}
        allowEmpty={false}
        onChange={handleChange}
        error={hasError}
        helperText={errorMessage}
        {...tooltipProp}
        sx={gridDropdownSx}
      >
        {children}
      </StyledDropdown>
    );
  }

  return (
    <StyledDropdown<TValue>
      ref={dropdownRootRef}
      ariaLabel={accessibleName}
      name={resolvedGridCellKey}
      restoreTargetAttributes={restoreTargetAttributes}
      width="100%"
      expectedOptionValues={cell.field.descriptor.codec.options}
      value={controller.value === undefined ? undefined : controller.value as TValue}
      allowEmpty
      placeholder={placeholder}
      onChange={handleChange}
      error={hasError}
      helperText={errorMessage}
      {...tooltipProp}
      sx={gridDropdownSx}
    >
      {children}
    </StyledDropdown>
  );
};

// forwardRef-fri generisk komponent (dropdownen eksponerer intet imperativt input-element).
const GridChoiceCell = GridChoiceCellInner as <
  TValue extends StyledDropdownValue,
  TEntity = unknown,
  TCanonical extends TValue | undefined = TValue | undefined,
>(
  props: GridChoiceCellProps<TValue, TEntity, TCanonical>
) => React.ReactElement;

export default GridChoiceCell;

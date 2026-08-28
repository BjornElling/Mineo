import * as React from 'react';

// Kun månedens FORM (`mm`) hentes her; de øvrige periodecellers form ejes af deres egen feltfamilie, og
// årscellens tidligere `åååå (≤CURRENT_YEAR)` er væk – grænsen hører i feltets issue/tooltip.
import { MONTH_FORMAT_PLACEHOLDER } from '../../utils/fieldFormatPlaceholders';
import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import { formatKr } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type {
  StandardLoenTableColumnKey,
  StandardLoenTableFirstErrorCell,
  StandardLoenTableSatser,
} from '../../types/table';
import type { StandardLoenTableHandle } from '../../types/handles';
import { createRowId } from '../../utils/rowId';
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import { blinkFieldAttention } from '../../inputCore/react/fieldAttentionBlink';
import {
  calculateStandardLoenRowDerived,
  roundStandardLoenAmountToTwoDecimals,
  type StandardLoenRowDerived,
} from '../../domain/aarsloen/standardLoenRowCalculations';
import {
  getStandardLoenPeriodKeys,
} from '../../domain/standardLoen/standardLoenTableValidation';
import { getStandardLoenTableHeaderNodes } from '../../domain/aarsloen/standardLoenTableColumns';
import type { StandardLoenTableFieldSet } from '../../domain/standardLoen/standardLoenTableFieldSet';
import { readStandardLoenTableRows } from '../../domain/standardLoen/standardLoenTableFieldSet';
import { serializeFieldAddress, type CollectionRef, type FieldAddress } from '../../inputCore/fieldAddress';
import type { FieldIssueSet } from '../../inputCore/inputIssue';
import { useInputEvaluation } from '../../inputCore/react';
import { collectionLocationPrefix } from '../../inputCore/react/cellSpecBuilder';
import {
  GridAmountCell,
  GridDateCell,
  GridIntegerCell,
  GridWeekCell,
  GridYearCell,
} from '../../inputCore/react/fields/gridCells';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { RowDeleteButton, rowDeleteLaneStyle } from './RowDeleteButton';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { useCollectionTable } from './useCollectionTable';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

// Den delte StandardLoenTable. Tabellen renderes i to kontekster: Årsløn (top-level `aarsloen.tableData`) og EO's
// løntabel NESTED under hvert ansættelsesforhold. `fieldSet` parametriserer collection + celle-descriptorer, så
// komponenten selv er sideagnostisk.
//  - `useCollectionRows(fieldSet.collection)` ejer rækkernes id'er + insert/delete/reorder (§3.8). En celles værdi
//    bor kun i inputaggregaten; der findes ingen konkurrerende celle-værdikopi.
//  - hver celle er en `Grid*Cell` over `useCellEditor` (draft/commit) bro-forbundet til grid-core-navigationen.
//    Celle-specs bygges af den FÆLLES `buildCollectionCellSpec`: begge cellearter bærer en fuldt bundet `FieldRef`,
//    hvor ejer-id'erne udledes af collectionens sti (§3.2). En trailing PLACEHOLDER-række promoverer atomisk ved
//    første ikke-tomme settle (§1.11).
//  - de committede rækker læses read-only via `readStandardLoenTableRows(fieldSet, reader)` – KUN til sortering,
//    afledte kolonner (col6/7/8) og tomheds-vurdering.
//  - valideringssummaryen er REN og reader-afledt (`resolveStandardLoenTableValidationFromReader`) – ikke et
//    imperativt celle-fejl-handle. Det imperative handle bærer KUN visuel feedback
//    (blink/scroll/missing-hint), og selve blinket er
//    den DELTE `blinkFieldAttention`, ikke en tabel-lokal animation.

export type StandardLoenTableProps = {
  /** Feltsættet, der binder tabellen til en konkret collection + celle-descriptors (§2.5-parametrisering). */
  fieldSet: StandardLoenTableFieldSet;
  loenperiode: Loenperiode;
  satser: StandardLoenTableSatser;
  // Beløb-tilstand: kolonnerne "FP/FV/SH/SO/St.B." og "Arb.g. Pension" bliver redigerbare beløbsfelter i stedet
  // for beregnede visningsfelter. Default 'procent' (nuværende adfærd).
  tillaegAngivesSom?: TillaegAngivesSom;
  useSmallFont?: boolean;
  saveOrderPath?: TableSaveOrderPath;
  calculateDerivedRow?: (row: StandardLoenTableRow) => StandardLoenRowDerived;
  /**
   * Eksplicit navigation-metadata for cellernes editorlokationer (§3.7): route + fane for den side/fane, tabellen
   * bor på. Tabellen renderes i flere kontekster (Årsløn vs. EO-lønindkomst), så route/fane kan ikke udledes af
   * `collection` – kalderen leverer den. Udeladt route = ikke-navigerbar lokation (restoren navigerer da ikke).
   */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;
  /**
   * KRYDS-RÆKKE-regler som feltissues (fx identiske rækker). Slås op på cellens egen bundne feltadresse og
   * gives videre som `collectionRuleIssue`, der er det ENESTE, der kan gøre en celle rød ud over cellens
   * eget issue. En descriptor-validator kan ikke se andre rækker og kan derfor ikke udtrykke reglen selv.
   */
  ruleIssues?: FieldIssueSet;
};

const MIN_VISIBLE_ROWS = 2;

// Kolonneindeks til grid-core-koordinaten `{ rowId, colIndex }`.
const COL = {
  period0: 0,
  period1: 1,
  col2: 2,
  col3: 3,
  col4: 4,
  col5: 5,
  beloeb0: 6,
  beloeb1: 7,
} as const;

const StandardLoenTable = React.memo(React.forwardRef<StandardLoenTableHandle, StandardLoenTableProps>(
  ({ fieldSet, loenperiode, satser, tillaegAngivesSom = 'procent', useSmallFont = false, saveOrderPath, calculateDerivedRow, locationNav, ruleIssues }, ref) => {
    const beloebMode = tillaegAngivesSom === 'beloeb';
    const evaluation = useInputEvaluation();
    const collection: CollectionRef = fieldSet.collection;

    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const cellRefsByCellKeyRef = React.useRef<Record<string, HTMLInputElement | null>>({});
    const registerCellRef = React.useCallback(
      (rowId: string, colIdx: number) => (el: HTMLInputElement | null) => {
        cellRefsByCellKeyRef.current[`${rowId}:${colIdx}`] = el;
      },
      []
    );

    // Committede rækker læses read-only fra readeren – til sortering, afledte kolonner og tomheds-vurdering.
    // Celleværdien bor kun i inputaggregaten; dette er ingen konkurrerende værdikopi (§3.8).
    const committedRows = React.useMemo(
      () => readStandardLoenTableRows(fieldSet, evaluation.reader),
      [evaluation, fieldSet]
    );
    // Tabellen bruges i flere kontekster (Årsløn + EO's nested løntabeller). Præfikset er derfor det
    // kanoniske `collectionLocationPrefix`, som bærer ejer-id'erne med: EO renderer én løntabel pr.
    // ansættelsesforhold, og det tidligere `standardLoen:${section}.${collection}` udelod dem, så to
    // kort delte ÉN editorlokation for deres rækkehandlinger. Celle-bindingen brugte allerede den
    // kanoniske form – de to var altså uenige om samme tabels lokation.
    //
    // Tomme rækker persisteres ikke; `minimumVisibleRows` er den rene VISNINGSregel (§1.11).
    const table = useCollectionTable<StandardLoenTableRow>({
      collection,
      committedRows,
      createRowId: React.useCallback(() => createRowId('row'), []),
      createEmptyRow: fieldSet.createRow,
      locationPrefix: collectionLocationPrefix(collection),
      locationNav,
      minimumVisibleRows: MIN_VISIBLE_ROWS,
    });
    const { committedById, buildCellSpec } = table;

    /**
     * Kryds-række-issuet for en celle, som en spread-bar prop.
     *
     * Opslaget sker på cellens EGEN, allerede bundne feltadresse (§3.2 – hele ejerstien er med), så det ikke
     * kan ramme en anden række eller en anden tabelinstans (EO renderer én løntabel pr. ansættelsesforhold).
     * `collectionRuleIssue` er det eneste, der kan gøre cellen rød ud over cellens eget issue, og cellens
     * eget issue har forrang – en ugyldig dato vises altså frem for dubletbeskeden.
     */
    const ruleIssueProps = React.useCallback(
      (cell: Readonly<{ field: Readonly<{ address: FieldAddress }> }>) => {
        const issue = ruleIssues?.get(serializeFieldAddress(cell.field.address));
        return issue === undefined ? {} : { collectionRuleIssue: issue };
      },
      [ruleIssues]
    );

    const getSatserInput = React.useCallback(() => ({
      feriePct: satser?.ferie,
      fritvalgPct: satser?.fritvalg,
      shSoPct: satser?.shSo,
      storeBededagPct: satser?.bededag,
      pensionPct: satser?.pension,
    }), [satser?.bededag, satser?.ferie, satser?.fritvalg, satser?.pension, satser?.shSo]);

    const calculateRow = React.useCallback(
      (row: StandardLoenTableRow): { col6: number; col7: number; col8: number } => {
        const derived = calculateDerivedRow ? calculateDerivedRow(row) : calculateStandardLoenRowDerived(row, getSatserInput(), { mode: tillaegAngivesSom });
        return {
          col6: derived.fpFvShSo,
          col7: derived.pension,
          col8: roundStandardLoenAmountToTwoDecimals(derived.samlet),
        };
      },
      [calculateDerivedRow, getSatserInput, tillaegAngivesSom]
    );

    // ── Sortering ──────────────────────────────────────────────────────────────
    const resolveCommittedRow = React.useCallback(
      (row: StandardLoenTableRow) => committedById.get(row.id) ?? row,
      [committedById]
    );
    const parseSortableInteger = React.useCallback((value: string | undefined): number | undefined => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === '') return undefined;
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }, []);
    const parseSortableWeekKey = React.useCallback((value: string | undefined): string | undefined => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === '') return undefined;
      const parts = trimmed.split('/');
      if (parts.length !== 2) return undefined;
      const week = Number.parseInt(parts[0] ?? '', 10);
      const year = Number.parseInt(parts[1] ?? '', 10);
      if (!Number.isFinite(week) || !Number.isFinite(year)) return undefined;
      if (week < 1 || week > 53) return undefined;
      return `${year.toString().padStart(4, '0')}-${week.toString().padStart(2, '0')}`;
    }, []);
    const sortColumns = React.useMemo(() => [
      {
        colId: 'col-0',
        getSortValue: (row: StandardLoenTableRow) => {
          const committed = resolveCommittedRow(row);
          if (loenperiode === 'maaned') return parseSortableInteger(committed.col0_maaned);
          if (loenperiode === 'uge') return parseSortableWeekKey(committed.col0_uge);
          return committed.col0_dag ?? '';
        },
      },
      {
        colId: 'col-1',
        getSortValue: (row: StandardLoenTableRow) => {
          const committed = resolveCommittedRow(row);
          if (loenperiode === 'maaned') return parseSortableInteger(committed.col1_maaned);
          if (loenperiode === 'uge') return parseSortableWeekKey(committed.col1_uge);
          return committed.col1_dag ?? '';
        },
      },
      { colId: 'col-2', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col2) },
      { colId: 'col-3', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col3) },
      { colId: 'col-4', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col4) },
      { colId: 'col-5', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col5) },
      {
        colId: 'col-6',
        getSortValue: (row: StandardLoenTableRow) => beloebMode
          ? amountValueToNumber(resolveCommittedRow(row).fpFvShSoBeloeb)
          : calculateRow(resolveCommittedRow(row)).col6,
      },
      {
        colId: 'col-7',
        getSortValue: (row: StandardLoenTableRow) => beloebMode
          ? amountValueToNumber(resolveCommittedRow(row).pensionBeloeb)
          : calculateRow(resolveCommittedRow(row)).col7,
      },
      { colId: 'col-8', getSortValue: (row: StandardLoenTableRow) => calculateRow(resolveCommittedRow(row)).col8 },
    ], [beloebMode, calculateRow, loenperiode, parseSortableInteger, parseSortableWeekKey, resolveCommittedRow]);

    const { sortedRows: sortedCommittedRows, sortableHeader } = useSortedCollectionTable({
      committedRows,
      getRowId: (row) => row.id,
      isRowEmpty: (row) => table.isRowEmpty(row.id),
      columns: sortColumns,
      reorderRows: table.reorderRows,
      saveOrderPath,
    });

    const renderRows = table.buildRenderRows(sortedCommittedRows);

    // Save-order = de committede rækker i sorteret rækkefølge (placeholder-rækker persisteres ikke).
    // ── Visuel peg-mekanisme ────────────────────────────────────────────────────
    // ALLE tre peg-handlinger går gennem den delte `blinkFieldAttention`. Tabellen fører ingen egen
    // markerings-state.
    //
    // Den tidligere `missingCell`-state satte blink-KLASSEN deklarativt for at lade markeringen «blive
    // stående, indtil værdien er indtastet». Den begrundelse holdt ikke: klassens animation løber
    // 0,5 s × 3 og efterlader derefter en helt gennemsigtig celle (målt), så der var ingen vedvarende
    // markering at vinde – kun en genstart at tabe. Et gentaget klik satte samme state igen, React
    // bailede ud, og brugeren fik INTET svar anden gang. Det var netop den fejl, en afvist
    // omregnings-aktivering viste: kun det første klik blinkede.
    const isVisibleColKey = React.useCallback(
      (colKey: StandardLoenTableColumnKey): boolean => {
        if (colKey === 'col0_maaned' || colKey === 'col1_maaned') return loenperiode === 'maaned';
        if (colKey === 'col0_uge' || colKey === 'col1_uge') return loenperiode === 'uge';
        if (colKey === 'col0_dag' || colKey === 'col1_dag') return loenperiode === 'dag';
        return true;
      },
      [loenperiode]
    );

    const resolveColIdxFromKey = React.useCallback((colKey: StandardLoenTableColumnKey): number => {
      if (colKey === 'fpFvShSoBeloeb') return COL.beloeb0;
      if (colKey === 'pensionBeloeb') return COL.beloeb1;
      if (colKey === 'col0_maaned' || colKey === 'col0_uge' || colKey === 'col0_dag') return COL.period0;
      if (colKey === 'col1_maaned' || colKey === 'col1_uge' || colKey === 'col1_dag') return COL.period1;
      return Number.parseInt(colKey.slice(3), 10);
    }, []);

    /**
     * Scroll cellen frem og lad den blinke. Den ENE peg-vej for alle tre handles.
     *
     * "Indtastning mangler" bruger SAMME visuelle idiom som en fejlflash frem for at overtage
     * placeholderens semantiske ansvar: cellen scrolles ind og blinker rødt, mens placeholderen
     * fortsat kun viser værdiens FORM (`mm`/`åååå`/`uu/åååå`/`dd-mm-åååå`). Markeringen er ikke en
     * feltfejl (§1.7) – den gør ikke feltet rødt og blokerer intet; den lokaliserer blot cellen.
     */
    const pointAtCell = React.useCallback((rowId: string, colKey: StandardLoenTableColumnKey): void => {
      if (!isVisibleColKey(colKey)) return;
      const el = cellRefsByCellKeyRef.current[`${rowId}:${resolveColIdxFromKey(colKey)}`];
      if (!el) return;
      scrollTargetIntoView(el, { force: true });
      // Den delte markering: samme mekanisme, som fejllinks, save-blokeringen og undo/redo bruger –
      // og den ENESTE, der genstarter animationen ved en gentagen peg-handling.
      blinkFieldAttention(el);
    }, [isVisibleColKey, resolveColIdxFromKey]);

    React.useImperativeHandle(
      ref,
      () => ({
        showMissingEntryError: (cell: StandardLoenTableFirstErrorCell) => {
          if (cell.reason !== 'missing') return;
          pointAtCell(cell.rowId, cell.colKey);
        },
        flashError: (error) => {
          pointAtCell(error.rowId, error.colKey);
        },
        showNeedsPeriodHint: () => {
          // Den FØRSTE viste række, uanset om den er committet eller en placeholder – altså render-
          // modellens første række, ikke to separate opslag der kan blive uenige.
          const firstRowId = renderRows[0]?.rowId;
          if (firstRowId === undefined) return;
          const [periodStartKey] = getStandardLoenPeriodKeys(loenperiode);
          pointAtCell(firstRowId, periodStartKey);
        },
      }),
      [loenperiode, pointAtCell, renderRows]
    );

    const headers = React.useMemo(() => getStandardLoenTableHeaderNodes(loenperiode), [loenperiode]);

    return (
      <StandardGridTable
        tableWidth="1130px"
        tableRef={tableRef}
        useSmallFont={useSmallFont}
      >
        <colgroup>
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '130px' }} />
        </colgroup>

        <thead>
          <tr>
            {headers.map((header, idx) => {
              const colId = `col-${idx}`;
              return (
                <StandardGridHeaderCell
                  key={colId}
                  {...sortableHeader(colId)}
                >
                  <span style={{ whiteSpace: 'pre-line' }}>{header}</span>
                </StandardGridHeaderCell>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {renderRows.map((renderRow, rowIndex) => {
            const rowId = renderRow.rowId;
            const committedRow = committedById.get(rowId) ?? fieldSet.createRow(rowId);
            const calculated = calculateRow(committedRow);
            const gc = (colIndex: number) => ({ rowId, colIndex });

            return (
              <tr key={rowId} data-mineo-row-id={rowId} style={getStandardGridBodyRowStyle(rowIndex)}>
                {/* Periode fra. `mm` på månedscellen er en ægte FORMAT-override: kolonnen viser måneden
                    alene, og heltalsfamilien kender ikke den form. Uge-, dato- og årscellerne arver
                    deres families rene form og får derfor INGEN placeholder-prop her. */}
                <td style={getStandardGridCellStyle({ align: 'center' })}>
                  {loenperiode === 'maaned' ? (() => {
                    const cell = buildCellSpec<string | undefined>(renderRow, fieldSet.col0_maaned, COL.period0);
                    return <GridIntegerCell
                      gridCell={gc(COL.period0)}
                      cell={cell}
                      placeholder={MONTH_FORMAT_PLACEHOLDER}
                      inputRef={registerCellRef(rowId, COL.period0)}
                      {...ruleIssueProps(cell)}
                    />;
                  })() : loenperiode === 'uge' ? (() => {
                    const cell = buildCellSpec<string | undefined>(renderRow, fieldSet.col0_uge, COL.period0);
                    return <GridWeekCell
                      gridCell={gc(COL.period0)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.period0)}
                      {...ruleIssueProps(cell)}
                    />;
                  })() : (() => {
                    const cell = buildCellSpec<ISODateString | undefined>(renderRow, fieldSet.col0_dag, COL.period0);
                    return <GridDateCell
                      gridCell={gc(COL.period0)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.period0)}
                      {...ruleIssueProps(cell)}
                    />;
                  })()}
                </td>

                {/* Periode til */}
                <td style={getStandardGridCellStyle({ align: 'center' })}>
                  {loenperiode === 'maaned' ? (() => {
                    const cell = buildCellSpec<string | undefined>(renderRow, fieldSet.col1_maaned, COL.period1);
                    return <GridYearCell
                      gridCell={gc(COL.period1)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.period1)}
                      {...ruleIssueProps(cell)}
                    />;
                  })() : loenperiode === 'uge' ? (() => {
                    const cell = buildCellSpec<string | undefined>(renderRow, fieldSet.col1_uge, COL.period1);
                    return <GridWeekCell
                      gridCell={gc(COL.period1)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.period1)}
                      {...ruleIssueProps(cell)}
                    />;
                  })() : (() => {
                    const cell = buildCellSpec<ISODateString | undefined>(renderRow, fieldSet.col1_dag, COL.period1);
                    return <GridDateCell
                      gridCell={gc(COL.period1)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.period1)}
                      {...ruleIssueProps(cell)}
                    />;
                  })()}
                </td>

                {/* Beløbskolonner col2..col5 */}
                {([
                  [COL.col2, fieldSet.col2] as const,
                  [COL.col3, fieldSet.col3] as const,
                  [COL.col4, fieldSet.col4] as const,
                  [COL.col5, fieldSet.col5] as const,
                ]).map(([colIdx, descriptor]) => {
                  const cell = buildCellSpec<AmountValue | undefined>(renderRow, descriptor, colIdx);
                  return (
                    <td key={colIdx} style={getStandardGridCellStyle({ align: 'right' })}>
                      <GridAmountCell
                        gridCell={gc(colIdx)}
                        cell={cell}
                        inputRef={registerCellRef(rowId, colIdx)}
                        {...ruleIssueProps(cell)}
                      />
                    </td>
                  );
                })}

                {/* FP/FV/SH/SO/St.B. – redigerbar i Beløb, afledt i Procent */}
                {beloebMode ? (() => {
                  const cell = buildCellSpec<AmountValue | undefined>(renderRow, fieldSet.fpFvShSoBeloeb, COL.beloeb0);
                  return <td style={getStandardGridCellStyle({ align: 'right' })}>
                    <GridAmountCell
                      gridCell={gc(COL.beloeb0)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.beloeb0)}
                      {...ruleIssueProps(cell)}
                    />
                  </td>;
                })() : (
                  <td style={{ ...getStandardGridCellStyle({ align: 'right' }), padding: '4px', color: 'var(--mineo-color-active-grid-derived)' }}>
                    {formatKr(calculated.col6, 2)}
                  </td>
                )}

                {/* Arb.g. Pension – redigerbar i Beløb, afledt i Procent */}
                {beloebMode ? (() => {
                  const cell = buildCellSpec<AmountValue | undefined>(renderRow, fieldSet.pensionBeloeb, COL.beloeb1);
                  return <td style={getStandardGridCellStyle({ align: 'right' })}>
                    <GridAmountCell
                      gridCell={gc(COL.beloeb1)}
                      cell={cell}
                      inputRef={registerCellRef(rowId, COL.beloeb1)}
                      {...ruleIssueProps(cell)}
                    />
                  </td>;
                })() : (
                  <td style={{ ...getStandardGridCellStyle({ align: 'right' }), padding: '4px', color: 'var(--mineo-color-active-grid-derived)' }}>
                    {formatKr(calculated.col7, 2)}
                  </td>
                )}

                {/* Samlet løn (altid afledt) + slet-række-knap */}
                <td
                  style={rowDeleteLaneStyle({
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    color: 'var(--mineo-color-active-grid-derived)',
                  })}
                >
                  {formatKr(calculated.col8, 2)}
                  {renderRow.kind === 'existing' && (
                    <RowDeleteButton onDelete={() => table.removeRow(rowId)} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StandardGridTable>
    );
  }
));

StandardLoenTable.displayName = 'StandardLoenTable';

export default StandardLoenTable;

import * as React from 'react';
import type { ISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  filterAmountExpressionKeyDown,
  filterDateLikeKeyDown,
  filterIntegerKeyDown,
  filterPercentKeyDown,
  filterWeekKeyDown,
  filterYearKeyDown,
} from '../../../components/inputs/inputKeyFilters';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_AMOUNT_PLACEHOLDER } from '../../../utils/amountInputUtils';
import { DATE_FORMAT_PLACEHOLDER, WEEK_FORMAT_PLACEHOLDER, YEAR_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import type { CellSpec } from '../useCellEditor';
import GridTextCell from './GridTextCell';

// Greenfield grid-celle-familier (§2.5/§3.5): tynde skaller over `GridTextCell`. Hver vælger kun sit
// tegnfilter + adornment + justering; parse/format/paste og commit-intervaller ejes af descriptorens codec +
// feltvalidatorer. De erstatter legacy `Table{Amount,Integer,Year,Week,Date}Input` for løntabellen.

type BaseCellProps<T> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<T, unknown>;
  placeholder?: string;
  /** Ekstern kryds-række-domænefejl (fx dublet-datoer); descriptorens eget issue har forrang. */
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}>;

/** Det lille `fx`-mærke, der vises i et beløbsfelt, hvis den committede værdi er et udtryk (legacy-visuel). */
const ExpressionIndicator = (): React.ReactElement => (
  <span
    className="mineo-expression-indicator"
    style={{
      position: 'absolute',
      right: 2,
      bottom: 2,
      fontSize: 8,
      fontWeight: 700,
      color: 'var(--color-grid-expression-indicator)',
      pointerEvents: 'none',
    }}
  >
    fx
  </span>
);

/** Beløbscelle (col2–col5, fpFvShSoBeloeb, pensionBeloeb): "kr."-adornment + `fx`-udtryksmærke. */
export const GridAmountCell = (
  { gridCell, cell, placeholder = DEFAULT_AMOUNT_PLACEHOLDER, inputRef }: BaseCellProps<AmountValue | undefined>
): React.ReactElement => {
  const keyFilter = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => filterAmountExpressionKeyDown(e, { allowNegative: true, allowDecimals: true }),
    []
  );
  return (
    <GridTextCell<AmountValue | undefined>
      gridCell={gridCell}
      cell={cell}
      keyFilter={keyFilter}
      placeholder={placeholder}
      textAlign="right"
      inputMode="decimal"
      endAdornment={({ isDraftEmpty }) => (
        <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.currency} muted={isDraftEmpty} />
      )}
      overlay={({ value }) => (value?.kind === 'expression' ? <ExpressionIndicator /> : null)}
      {...(inputRef === undefined ? {} : { inputRef })}
    />
  );
};

/**
 * Procentcelle (EET ASL-afgørelser eetPct/kapPct): "%"-adornment + højrestillet tabular-nums. Grid-pendanten til
 * `PercentField`. `allowDecimals` styrer kun tegnfilteret i den åbne draft; 0..100-bounds og
 * divisible-by-5/ikke-0-reglerne er afledte feltvalidatorer på descriptoren (§1.6), ikke celle-config.
 */
export const GridPercentCell = (
  { gridCell, cell, placeholder = '0', externalErrorMessage, inputRef, allowDecimals = false }:
    BaseCellProps<number | undefined> & Readonly<{ allowDecimals?: boolean }>
): React.ReactElement => {
  const keyFilter = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => filterPercentKeyDown(e, { allowNegative: false, allowDecimals }),
    [allowDecimals]
  );
  return (
    <GridTextCell<number | undefined>
      gridCell={gridCell}
      cell={cell}
      keyFilter={keyFilter}
      placeholder={placeholder}
      textAlign="right"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      endAdornment={({ isDraftEmpty }) => (
        <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={isDraftEmpty} />
      )}
      {...(externalErrorMessage === undefined ? {} : { externalErrorMessage })}
      {...(inputRef === undefined ? {} : { inputRef })}
    />
  );
};

/** Heltalscelle (col0_maaned: måned 1–12). */
export const GridIntegerCell = <T extends string | number | undefined>(
  { gridCell, cell, placeholder, inputRef }: BaseCellProps<T>
): React.ReactElement => {
  const keyFilter = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) =>
      filterIntegerKeyDown(e, { allowNegative: true }),
    []
  );
  return (
    <GridTextCell<T>
      gridCell={gridCell}
      cell={cell}
      keyFilter={keyFilter}
      {...(placeholder === undefined ? {} : { placeholder })}
      textAlign="center"
      inputMode="numeric"
      {...(inputRef === undefined ? {} : { inputRef })}
    />
  );
};

/** År-celle (col1_maaned): formen `åååå` ejes af feltfamilien, ikke af tabellen (UT-F06). */
export const GridYearCell = (
  { gridCell, cell, placeholder = YEAR_FORMAT_PLACEHOLDER, inputRef }: BaseCellProps<string | undefined>
): React.ReactElement => (
  <GridTextCell<string | undefined>
    gridCell={gridCell}
    cell={cell}
    keyFilter={filterYearKeyDown}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

/** Uge-celle (col0_uge/col1_uge): formen `uu/åååå`. */
export const GridWeekCell = (
  { gridCell, cell, placeholder = WEEK_FORMAT_PLACEHOLDER, inputRef }: BaseCellProps<string | undefined>
): React.ReactElement => (
  <GridTextCell<string | undefined>
    gridCell={gridCell}
    cell={cell}
    keyFilter={filterWeekKeyDown}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

/** Dato-celle (col0_dag/col1_dag): formen `dd-mm-åååå`. */
export const GridDateCell = (
  { gridCell, cell, placeholder = DATE_FORMAT_PLACEHOLDER, externalErrorMessage, inputRef }: BaseCellProps<ISODateString | undefined>
): React.ReactElement => (
  <GridTextCell<ISODateString | undefined>
    gridCell={gridCell}
    cell={cell}
    keyFilter={filterDateLikeKeyDown}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    {...(externalErrorMessage === undefined ? {} : { externalErrorMessage })}
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

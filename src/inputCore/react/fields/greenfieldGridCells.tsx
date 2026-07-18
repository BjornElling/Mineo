import * as React from 'react';
import type { ISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  filterAmountExpressionKeyDown,
  filterDateLikeKeyDown,
  filterIntegerKeyDown,
  filterWeekKeyDown,
  filterYearKeyDown,
} from '../../../components/inputs/inputKeyFilters';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_AMOUNT_PLACEHOLDER } from '../../../utils/amountInputUtils';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import type { CellSpec } from '../useCellEditor';
import GreenfieldGridTextCell from './GreenfieldGridTextCell';

// Greenfield grid-celle-familier (§2.5/§3.5): tynde skaller over `GreenfieldGridTextCell`. Hver vælger kun sit
// tegnfilter + adornment + justering; parse/format/paste og commit-intervaller ejes af descriptorens codec +
// feltvalidatorer. De erstatter legacy `Table{Amount,Integer,Year,Week,Date}Input` for løntabellen.

type BaseCellProps<T> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<T, unknown>;
  placeholder?: string;
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
export const GreenfieldGridAmountCell = (
  { gridCell, cell, placeholder = DEFAULT_AMOUNT_PLACEHOLDER, inputRef }: BaseCellProps<AmountValue | undefined>
): React.ReactElement => {
  const keyFilter = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => filterAmountExpressionKeyDown(e, { allowNegative: true, allowDecimals: true }),
    []
  );
  return (
    <GreenfieldGridTextCell<AmountValue | undefined>
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

/** Heltalscelle (col0_maaned: måned 1–12). */
export const GreenfieldGridIntegerCell = (
  { gridCell, cell, placeholder, inputRef }: BaseCellProps<string | undefined>
): React.ReactElement => {
  const keyFilter = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) =>
      filterIntegerKeyDown(e, { allowNegative: true }),
    []
  );
  return (
    <GreenfieldGridTextCell<string | undefined>
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

/** År-celle (col1_maaned). */
export const GreenfieldGridYearCell = (
  { gridCell, cell, placeholder, inputRef }: BaseCellProps<string | undefined>
): React.ReactElement => (
  <GreenfieldGridTextCell<string | undefined>
    gridCell={gridCell}
    cell={cell}
    keyFilter={filterYearKeyDown}
    {...(placeholder === undefined ? {} : { placeholder })}
    textAlign="center"
    inputMode="numeric"
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

/** Uge-celle (col0_uge/col1_uge): `WW-YYYY`. */
export const GreenfieldGridWeekCell = (
  { gridCell, cell, placeholder, inputRef }: BaseCellProps<string | undefined>
): React.ReactElement => (
  <GreenfieldGridTextCell<string | undefined>
    gridCell={gridCell}
    cell={cell}
    keyFilter={filterWeekKeyDown}
    {...(placeholder === undefined ? {} : { placeholder })}
    textAlign="center"
    inputMode="numeric"
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

/** Dato-celle (col0_dag/col1_dag): `dd-mm-åååå`. */
export const GreenfieldGridDateCell = (
  { gridCell, cell, placeholder = 'dd-mm-åååå', inputRef }: BaseCellProps<ISODateString | undefined>
): React.ReactElement => (
  <GreenfieldGridTextCell<ISODateString | undefined>
    gridCell={gridCell}
    cell={cell}
    keyFilter={filterDateLikeKeyDown}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

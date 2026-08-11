import * as React from 'react';
import type { ISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  amountExpressionAdmission,
  dateLikeAdmission,
  integerAdmission,
  percentAdmission,
  weekAdmission,
  yearAdmission,
} from '../../../components/inputs/draftAdmission';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import {
  DEFAULT_AMOUNT_PLACEHOLDER,
  INTEGER_AMOUNT_PLACEHOLDER,
} from '../../../utils/amountInputUtils';
import {
  DEFAULT_PERCENT_PLACEHOLDER,
  TWO_DECIMAL_PERCENT_PLACEHOLDER,
} from '../../../utils/percentInputUtils';
import { DATE_FORMAT_PLACEHOLDER, WEEK_FORMAT_PLACEHOLDER, YEAR_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import type { FieldWarning } from '../../fieldWarning';
import type { FieldIssue } from '../../inputIssue';
import type { CellSpec } from '../useCellEditor';
import GridTextCell from './GridTextCell';
import { fieldAllowsNegative } from './signPolicy';
import { resolveAmountCharPolicy, resolvePercentCharPolicy } from './charLengthPolicy';
import { MAX_DATE_DRAFT_LENGTH } from '../../../utils/dateDraftCommit';

// Modul-konstante prædikater for de familier, hvis form ikke afhænger af descriptoren.
const YEAR_ADMISSION = yearAdmission();
const WEEK_ADMISSION = weekAdmission();
const DATE_ADMISSION = dateLikeAdmission();

// Grid-celle-familier (§2.5/§3.5): tynde skaller over `GridTextCell`. Hver vælger kun sit
// tegn-/længdeprædikat + adornment + justering; parse/format/paste og commit-intervaller ejes af descriptorens codec
// og feltvalidatorer.

type BaseCellProps<T> = Readonly<{
  gridCell: GridCellCoord;
  cell: CellSpec<T, unknown>;
  placeholder?: string;
  /** Ekstern kryds-række-domænefejl (fx dublet-datoer); descriptorens eget issue har forrang. */
  collectionRuleIssue?: FieldIssue;
  warning?: FieldWarning;
  inputRef?: React.Ref<HTMLInputElement>;
}>;

/** Det lille `fx`-mærke, der vises i et beløbsfelt, hvis den committede værdi er et udtryk. */
const ExpressionIndicator = (): React.ReactElement => (
  <span
    className="mineo-expression-indicator"
    style={{
      position: 'absolute',
      right: 2,
      bottom: 2,
      fontSize: 8,
      fontWeight: 700,
      color: 'var(--mineo-color-expression-indicator)',
      pointerEvents: 'none',
    }}
  >
    fx
  </span>
);

/** Beløbscelle (col2–col5, fpFvShSoBeloeb, pensionBeloeb): "kr."-adornment + `fx`-udtryksmærke. */
export const GridAmountCell = (
  { gridCell, cell, placeholder, inputRef }: BaseCellProps<AmountValue | undefined>
): React.ReactElement => {
  // Tegn- og længdepolitikken kommer fra cellens egen descriptor gennem den DELTE
  // `resolveAmountCharPolicy` — samme kilde som formularens `AmountField`. Løntabellens beløbskolonner
  // ER fortegnede, mens fx et 0-og-op-beløb i en anden tabel ikke er, og cellen deler kode; men INGEN af
  // grænserne må længere være et lokalt valg her, for det var netop dét, der lod celle og formular
  // håndhæve forskellige decimal- og længdegrænser på samme felt.
  const { allowNegative, allowDecimals, maxIntegerDigits, maxDecimalDigits, maxDraftLength } =
    resolveAmountCharPolicy(cell.field);
  const resolvedPlaceholder = placeholder
    ?? (allowDecimals ? DEFAULT_AMOUNT_PLACEHOLDER : INTEGER_AMOUNT_PLACEHOLDER);
  const admission = React.useMemo(
    () => amountExpressionAdmission({
      allowNegative,
      allowDecimals,
      maxIntegerDigits,
      maxDecimalDigits,
    }),
    [allowDecimals, allowNegative, maxIntegerDigits, maxDecimalDigits]
  );
  return (
    <GridTextCell<AmountValue | undefined>
      gridCell={gridCell}
      cell={cell}
      admission={admission}
      placeholder={resolvedPlaceholder}
      textAlign="right"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      maxDraftLength={maxDraftLength}
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
 * `PercentField`. Decimalpolitikken kommer fra cellens codec; 0..100-bounds og divisible-by-5/ikke-0-reglerne
 * er afledte feltvalidatorer på descriptoren (§1.6), ikke celle-config.
 */
export const GridPercentCell = (
  { gridCell, cell, placeholder, collectionRuleIssue, warning, inputRef }:
    BaseCellProps<number | undefined>
): React.ReactElement => {
  // Politikken læses nu af descriptoren. Cellen svarede før hardkodet `false` — tilfældigvis RIGTIGT
  // for alle nuværende procent-descriptorer, men uden nogen forbindelse til det, de erklærede. Netop derfor
  // kunne formular-pendanten svare `true` på samme felter, uden at noget blev rødt.
  const { allowNegative, allowDecimals, maxIntegerDigits, maxDraftLength } =
    resolvePercentCharPolicy(cell.field);
  const resolvedPlaceholder = placeholder
    ?? (allowDecimals ? TWO_DECIMAL_PERCENT_PLACEHOLDER : DEFAULT_PERCENT_PLACEHOLDER);
  const admission = React.useMemo(
    () => percentAdmission({ allowNegative, allowDecimals, maxIntegerDigits }),
    [allowNegative, allowDecimals, maxIntegerDigits]
  );
  return (
    <GridTextCell<number | undefined>
      gridCell={gridCell}
      cell={cell}
      admission={admission}
      placeholder={resolvedPlaceholder}
      textAlign="right"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      maxDraftLength={maxDraftLength}
      endAdornment={({ isDraftEmpty }) => (
        <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={isDraftEmpty} />
      )}
      {...(collectionRuleIssue === undefined ? {} : { collectionRuleIssue })}
      {...(warning === undefined ? {} : { warning })}
      {...(inputRef === undefined ? {} : { inputRef })}
    />
  );
};

/** Heltalscelle (col0_maaned: måned 1–12). */
export const GridIntegerCell = <T extends string | number | undefined>(
  { gridCell, cell, placeholder, inputRef }: BaseCellProps<T>
): React.ReactElement => {
  // Fortegns-politikken kommer fra descriptoren. Månedscellen er et string-backed heltal 1..12, så
  // adapterens viderestilling af politikken er det, der gør minus umuligt at taste her.
  const allowNegative = fieldAllowsNegative(cell.field);
  const maxDigits = cell.field.descriptor.codec.maxDigits;
  const admission = React.useMemo(
    () => integerAdmission({ allowNegative, ...(maxDigits === undefined ? {} : { maxDigits }) }),
    [allowNegative, maxDigits]
  );
  return (
    <GridTextCell<T>
      gridCell={gridCell}
      cell={cell}
      admission={admission}
      {...(placeholder === undefined ? {} : { placeholder })}
      textAlign="center"
      inputMode="numeric"
      {...(inputRef === undefined ? {} : { inputRef })}
    />
  );
};

/** År-celle (col1_maaned): formen `åååå` ejes af feltfamilien, ikke af tabellen. */
export const GridYearCell = (
  { gridCell, cell, placeholder = YEAR_FORMAT_PLACEHOLDER, inputRef }: BaseCellProps<string | undefined>
): React.ReactElement => (
  <GridTextCell<string | undefined>
    gridCell={gridCell}
    cell={cell}
    admission={YEAR_ADMISSION}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    maxDraftLength={MAX_DATE_DRAFT_LENGTH}
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
    admission={WEEK_ADMISSION}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

/** Dato-celle (col0_dag/col1_dag): formen `dd-mm-åååå`. */
export const GridDateCell = (
  { gridCell, cell, placeholder = DATE_FORMAT_PLACEHOLDER, collectionRuleIssue, inputRef }: BaseCellProps<ISODateString | undefined>
): React.ReactElement => (
  <GridTextCell<ISODateString | undefined>
    gridCell={gridCell}
    cell={cell}
    admission={DATE_ADMISSION}
    placeholder={placeholder}
    textAlign="center"
    inputMode="numeric"
    maxDraftLength={MAX_DATE_DRAFT_LENGTH}
    {...(collectionRuleIssue === undefined ? {} : { collectionRuleIssue })}
    {...(inputRef === undefined ? {} : { inputRef })}
  />
);

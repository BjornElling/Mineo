import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../../utils/mergeSx';

import { coerceToDanishDateString, coerceToISODateString } from '../../../types/branded';
import type { ISODateString } from '../../../types/branded';
import type { DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import { useGridCoreApi } from '../../tables/useGridCore';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import {
  createDateTableInputAdapter,
  sanitizeTableDateDraft,
  type TableYearPolicy,
  useTableInputCore,
} from '../../../hooks/tableInput';

export type TableDateInputChangeEvent = { target: { value: string } };
export type TableDateInputCommitEvent = { target: { value: ISODateString | undefined } };
export type TableDateSanitizeCallback = (value: string) => ISODateString | undefined;

export type TableDateInputProps = Readonly<{
  gridCell: GridCellCoord;
  undoFieldPathAliases?: readonly string[];
  locked?: boolean;
  value?: ISODateString;
  minDate?: string;
  maxDate?: string;
  specialRangeErrors?: DateRangeSpecialErrors;
  /**
   * Valgfri læsbar forklaring af hvilke andre inputs der bestemmer min/max-bounds.
   *
   * Bruges når der ikke er nogen gyldige datoer, fordi `minDate > maxDate`.
   * Dette skal referere til konkrete brugersynlige inputs (fx "Dato til i samme række" osv.).
   */
  noValidRangeCause?: string;
  /**
   * Politik for fortolkning af 1-2-cifrede år ved commit.
   *
   * Default: `infer` (via `interpretYear`).
   */
  twoDigitYearPolicy?: TableYearPolicy;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';

  /**
   * Draft-ændring (kun typing).
   */
  onChange?: (e: TableDateInputChangeEvent) => void;

  /**
   * Commit-forsøg (kun blur).
   * Udsender kun den committede værdi når commit lykkes.
   * Ugyldigt input eller config-fejl forbliver lokale (fejltilstand) og opdaterer ikke forælderens værdi.
   * Range-overtrædelser blokerer aldrig commit (de viser kun en valideringsfejl).
   */
  onBlur?: (e: TableDateInputCommitEvent) => void;

  onErrorChange?: (info: TableInputErrorInfo) => void;
  onRegisterSanitize?: (sanitize: TableDateSanitizeCallback) => void;
  externalErrorMessage?: string;

  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const normalizeDateBoundConfig = (value: string | undefined): ISODateString | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};

const TableDateInput = React.memo(
  ({
    gridCell,
    undoFieldPathAliases,
    locked = false,
    value,
    onChange,
    onBlur,
    onErrorChange,
    onRegisterSanitize,
    minDate,
    maxDate,
    specialRangeErrors,
    noValidRangeCause,
    twoDigitYearPolicy = 'infer',
    placeholder = 'dd-mm-åååå',
    inputMode = 'text',
    externalErrorMessage,
    inputRef,
    sx,
  }: TableDateInputProps) => {
    const gridApi = useGridCoreApi();

    const boundsStatus = React.useMemo(() => {
      const normalizedMin = normalizeDateBoundConfig(minDate);
      const normalizedMax = normalizeDateBoundConfig(maxDate);

      if (minDate !== undefined && minDate.trim() !== '' && normalizedMin === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: minDate er ikke en dato (${String(minDate)})` };
      }
      if (maxDate !== undefined && maxDate.trim() !== '' && normalizedMax === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: maxDate er ikke en dato (${String(maxDate)})` };
      }

      if (normalizedMin && normalizedMax && normalizedMin > normalizedMax) {
        const minText = coerceToDanishDateString(normalizedMin) ?? normalizedMin;
        const maxText = coerceToDanishDateString(normalizedMax) ?? normalizedMax;
        const causeSuffix =
          typeof noValidRangeCause === 'string' && noValidRangeCause.trim() !== ''
            ? ` Årsag: ${noValidRangeCause.trim()}`
            : ' Kontrollér de felter der bestemmer datointervallet.';
        return {
          kind: 'no-valid-range' as const,
          message: `Ingen gyldige datoer: min-dato (${minText}) er efter max-dato (${maxText}).${causeSuffix}`,
        };
      }

      return { kind: 'ok' as const };
    }, [maxDate, minDate, noValidRangeCause]);

    if (boundsStatus.kind === 'hard-config') {
      throw new Error(boundsStatus.message);
    }

    const configErrorMessage = boundsStatus.kind === 'no-valid-range' ? boundsStatus.message : '';
    const effectiveMinDate = configErrorMessage === '' ? normalizeDateBoundConfig(minDate) : undefined;
    const effectiveMaxDate = configErrorMessage === '' ? normalizeDateBoundConfig(maxDate) : undefined;

    const adapter = React.useMemo(
      () =>
        createDateTableInputAdapter({
          minDate: effectiveMinDate,
          maxDate: effectiveMaxDate,
          specialRangeErrors,
          twoDigitYearPolicy,
        }),
      [effectiveMaxDate, effectiveMinDate, specialRangeErrors, twoDigitYearPolicy]
    );

    const core = useTableInputCore({
      adapter,
      gridCell,
      undoFieldPathAliases,
      value,
      locked,
      onChange,
      onBlur,
      // onErrorChange bevidst IKKE videregivet til kernen: dato-inputtet har en config-fejl-kilde
      // (ugyldige bounds), der lever uden for kernen, så komponenten er ENESTE reporter på denne
      // kanal (jf. effekten nedenfor). Ellers ville både kernen og komponenten skrive til samme
      // onErrorChange og kunne afgive modstridende rapporter til aggregat-/PDF-gates.
      inputRef,
    });

    const sanitizeValue: TableDateSanitizeCallback = React.useCallback(
      (rawValue) => sanitizeTableDateDraft(rawValue, { twoDigitYearPolicy }),
      [twoDigitYearPolicy]
    );

    React.useEffect(() => {
      onRegisterSanitize?.(sanitizeValue);
    }, [onRegisterSanitize, sanitizeValue]);

    // Eneste reporter på onErrorChange-kanalen: rapportér unionen af config-fejl (uden for kernen)
    // og kernens input/visual-fejl, deduplikeret så aggregat-/PDF-gates kun ser reelle ændringer.
    const lastReportedErrorRef = React.useRef<TableInputErrorInfo | null>(null);
    React.useEffect(() => {
      if (!onErrorChange) return;
      const next: TableInputErrorInfo =
        configErrorMessage !== ''
          ? { hasError: true, kind: 'config' }
          : core.hasError
            ? { hasError: true, kind: core.errorKind }
            : { hasError: false, kind: 'none' };
      const prev = lastReportedErrorRef.current;
      if (prev !== null && prev.hasError === next.hasError && prev.kind === next.kind) return;
      lastReportedErrorRef.current = next;
      onErrorChange(next);
    }, [configErrorMessage, core.errorKind, core.hasError, onErrorChange]);

    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    // Dato-specifikke config-fejl produceres uden for core, så ugyldige bounds kan vises selv uden et commit-forsøg.
    const showError = (hasExternalError || configErrorMessage !== '' || (core.touched && core.hasError)) && !core.isFocused;
    const tooltipText = hasExternalError ? externalErrorText : configErrorMessage !== '' ? configErrorMessage : core.errorMessage;

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        {/* Tooltip child stays a native span so table layout semantics are unaffected by a MUI Box wrapper. */}
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <InputBase
            inputRef={core.inputRefCallback}
            autoComplete="off"
            value={core.renderedValue}
            readOnly={core.isReadOnly}
            onChange={core.handleChange}
            onFocus={core.handleFocus}
            onBlur={core.handleBlur}
            onKeyDown={core.handleKeyDown}
            onPaste={core.handlePaste}
            onCopy={core.handleCopy}
            onDoubleClick={core.handleDoubleClick}
            placeholder={core.cellFocused && !core.isReadOnly ? '' : placeholder}
            inputProps={{
              id: core.a11yInputId,
              name: core.htmlInputName,
              readOnly: core.isReadOnly,
              tabIndex: locked ? -1 : undefined,
              inputMode,
              'data-mineo-grid-locked': locked ? 'true' : undefined,
              'data-mineo-undo-focus-token': core.undoFocusToken,
              'data-mineo-undo-field-path': core.gridCellKey ?? undefined,
              'data-mineo-undo-field-path-aliases': core.undoFieldPathAliasesAttr,
              'data-mineo-field-path': core.invalidDraftFieldPath ?? undefined,
              'aria-describedby': showError ? core.a11yErrorId : undefined,
            }}
            sx={mergeSx({
              ...getTableInputRootStyles({
                showError,
                  tableKind: gridApi.tableKind,
                  locked,
              }),
              ...(core.cellFocused ? { outline: 'none' } : {}),
              '& .MuiInputBase-input': {
                ...getTableInputElementStyles({
                  textAlign: 'center',
                  cursor: core.isEditing ? 'text' : 'pointer',
                  caretColor: core.isEditing ? 'auto' : 'transparent',
                }),
              },
            }, sx)}
          />
          {showError ? (
            <span id={core.a11yErrorId} style={visuallyHiddenStyle}>
              {tooltipText}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

TableDateInput.displayName = 'TableDateInput';

export default TableDateInput;

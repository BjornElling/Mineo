import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCellEditing, useGridCellFocus, useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCore/gridCoreTypes';
import { assignRef } from './assignRef';
import { type TableInputErrorInfo } from '../../../utils/tableInputContracts';
import { containsUnaryMinusToken, filterAmountExpressionKeyDown } from '../inputKeyFilters';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { sanitizePastedAmount } from '../../../utils/amountInputUtils';
import { copyWholeValueFromReadOnlyField, readClipboardText } from '../../../utils/clipboardUtils';
import { normalizeAmountPaste } from '../../../utils/inputPasteNormalization';
import {
  amountValueToDisplayString,
  amountValueToDraftString,
  formatExpressionErrorMessage,
  parseAmountInput,
} from '../../../utils/expressionAmount';
import { formatRoundedCanonical } from '../../../utils/rounding';
import { makeAmountFingerprintFromCanonical, type AmountFingerprint, type CommittedPayload } from '../../../types/parserSpec';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';

export type TableAmountInputValue = AmountValue | undefined;

export type TableAmountInputChangeEvent = { target: { value: string } };
export type TableAmountInputCommitEvent = { target: { value: AmountValue | undefined } };

export type TableAmountInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  /**
   * Table cell values persist as committed amount values.
   */
  value?: TableAmountInputValue;
  /**
   * Column policy: whether negative values are allowed.
   *
   * Default: true.
   */
  canBeNegative?: boolean;
  placeholder?: string;
  onChange?: (e: TableAmountInputChangeEvent) => void;
  onBlur?: (e: TableAmountInputCommitEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TABLE_AMOUNT_PRECISION = 2;
const MAX_AMOUNT_RAW_LENGTH = 64;
const MAX_AMOUNT_INTEGER_DIGITS = 20;

const commitAmountDraft = (
  draft: string,
  { canBeNegative }: { canBeNegative: boolean }
): { ok: true; value: AmountValue | undefined } | { ok: false; errorMessage: string } => {
  const parsed = parseAmountInput(draft, {
    precision: TABLE_AMOUNT_PRECISION,
    allowNegative: canBeNegative,
    maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
    maxRawLength: MAX_AMOUNT_RAW_LENGTH,
  });

  if (parsed.ok) {
    return { ok: true, value: parsed.value };
  }

  if (parsed.error.kind === 'expression') {
    return { ok: false, errorMessage: formatExpressionErrorMessage(parsed.error.message) };
  }
  return { ok: false, errorMessage: parsed.error.message };
};

const toDisplayString = (value: TableAmountInputValue): string => {
  return amountValueToDisplayString(value, TABLE_AMOUNT_PRECISION);
};

const amountCanonicalFromModel = (value: TableAmountInputValue): string => {
  if (!value) return '';
  if (value.kind === 'expression') {
    return `e:${value.expression.length}:${value.expression}|${formatRoundedCanonical(value.value, TABLE_AMOUNT_PRECISION)}`;
  }
  return `n:${formatRoundedCanonical(value.value, TABLE_AMOUNT_PRECISION)}`;
};

const amountFingerprintFromCanonical = (canonical: string): AmountFingerprint => {
  return makeAmountFingerprintFromCanonical(canonical);
};

const toCommittedAmountPayload = (value: TableAmountInputValue): CommittedPayload<AmountValue | undefined, string, AmountFingerprint> => {
  const canonical = amountCanonicalFromModel(value);
  return {
    model: value,
    canonical,
    fingerprint: amountFingerprintFromCanonical(canonical),
  };
};

const TableAmountInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    canBeNegative = true,
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableAmountInputProps) => {
    const gridApi = useGridCoreApi();
    const cellFocused = useGridCellFocus(gridCell);
    const isEditing = useGridCellEditing(gridCell);
    const isReadOnly = locked || !isEditing;
    const isLooseTable = gridApi.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';

    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const [draft, setDraft] = React.useState<string>(() => toDisplayString(value));
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const draftRef = React.useRef(draft);
    const hasErrorRef = React.useRef(hasError);

    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const skipClickSelectionRestoreRef = React.useRef(false);
    const latestCommittedPayloadRef = React.useRef<CommittedPayload<AmountValue | undefined, string, AmountFingerprint>>(toCommittedAmountPayload(value));

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, canBeNegative });

    React.useEffect(() => {
      latestCommittedPayloadRef.current = toCommittedAmountPayload(value);
    }, [value]);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, canBeNegative };
    }, [canBeNegative, locked, onBlur, onChange, onErrorChange]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

    React.useEffect(() => {
      hasErrorRef.current = hasError;
    }, [hasError]);

    const emitBlur = React.useCallback((nextValue: AmountValue | undefined) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      if (!isEditing) {
        const inputEl = inputElRef.current;
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const hasPhysicalFocus =
          inputEl !== null &&
          activeEl !== null &&
          (activeEl === inputEl || (activeEl instanceof Node && inputEl.contains(activeEl)));
        if (hasPhysicalFocus) return;
        if (hasError) return;
        setDraft(toDisplayString(value));
      }
    }, [hasError, isEditing, value]);

    React.useLayoutEffect(() => {
      if (!isEditing) {
        keyInitiatedEditRef.current = false;
        return;
      }
      // Click-initiated edit: initialize the draft from the current committed value.
      if (!keyInitiatedEditRef.current) {
        if (hasErrorRef.current) {
          originalValueOnEditStartRef.current = draftRef.current;
          return;
        }
        const committedValue = amountValueToDraftString(value, TABLE_AMOUNT_PRECISION);
        // For numeric amount cells, closed display and opened edit currently use the same
        // formatted string. The bug is therefore not string-shape conversion, but loss of the
        // browser's pointer-placed selection during the click-triggered re-render into edit mode.
        // We restore the same offsets explicitly. If the numeric display/edit formats diverge in
        // the future, this logic must be revisited alongside new tests.
        originalValueOnEditStartRef.current = committedValue;
        setDraft(committedValue);
        const shouldRestoreSelection = !skipClickSelectionRestoreRef.current;
        skipClickSelectionRestoreRef.current = false;
        if (value?.kind === 'expression' || !shouldRestoreSelection) return;
        const selectionStart = inputElRef.current?.selectionStart;
        const selectionEnd = inputElRef.current?.selectionEnd;
        if (typeof selectionStart !== 'number' || typeof selectionEnd !== 'number') return;
        const inputEl = inputElRef.current;
        if (!inputEl) return;
        try {
          inputEl.setSelectionRange(
            Math.min(selectionStart, inputEl.value.length),
            Math.min(selectionEnd, inputEl.value.length)
          );
        } catch {
          // no-op
        }
        // Ingen emitValueChange her - vi må ikke opdatere parent under edit.
      }
    }, [isEditing, value]);

    const handleDoubleClick = React.useCallback(() => {
      skipClickSelectionRestoreRef.current = true;
    }, []);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string): boolean => {
        setTouched(true);
        const committed = commitAmountDraft(rawDraft, { canBeNegative: latest.current.canBeNegative });

        if (!committed.ok) {
          setHasError(true);
          setErrorMessage(committed.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          return false;
        }

        const nextPayload = toCommittedAmountPayload(committed.value);
        const isNoop = nextPayload.fingerprint === latestCommittedPayloadRef.current.fingerprint;
        // Kontrakt 1A: no-op må aldrig emitte commit til parent.
        if (isNoop) {
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          return true;
        }

        setHasError(false);
        setErrorMessage('');
        latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        emitBlur(nextPayload.model);
        return true;
      },
      [emitBlur]
    );

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        const nextDraft = sanitizePastedAmount(e.target.value ?? '');
        setHasError(false);
        setErrorMessage('');
        if (nextDraft === '') {
          setTouched(false);
        }
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        // VIGTIGT: Ingen live preview + Escape kræver at vi IKKE lækker draft til parent under edit.
        // Parent opdateres kun ved commit (onBlur/commitAndEmitBlur).
      },
      [isReadOnly]
    );

    const handleFocus = React.useCallback(() => {
      setIsFocused(true);
      // Caret styling er nu declarativ via sx prop
    }, []);

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        // Vigtigt: grid kan lukke editor-state før input-blur ved klik udenfor.
        // I den situation skal vi stadig committe draften fra ref, hvis den afviger fra committed.
        const rawValue = isEditing ? (e.currentTarget.value ?? '') : draftRef.current;
        const committedValue = toDisplayString(latestCommittedPayloadRef.current.model);
        if (!isEditing && rawValue === committedValue) return;
        commitAndEmitBlur(rawValue);
      },
      [commitAndEmitBlur, isEditing]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Filtrér kun under edit-mode (arvet fra StyledAmountField)
        if (!isEditing) return;
        filterAmountExpressionKeyDown(e, { allowNegative: canBeNegative });
      },
      [canBeNegative, isEditing]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const raw = readClipboardText(e);
        const normalized = normalizeAmountPaste(raw, { allowNegative: canBeNegative });

        if (!isEditing) {
          e.preventDefault();
          e.stopPropagation();
          if (normalized === '') return;
          setDraft(normalized);
          draftRef.current = normalized;
          const ok = commitAndEmitBlur(normalized);
          if (!ok) return;
          setIsFocused(true);
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        const nextDraft = draft.slice(0, start) + normalized + draft.slice(end);
        if (!canBeNegative && containsUnaryMinusToken(nextDraft)) return;
        setHasError(false);
        setErrorMessage('');
        if (nextDraft === '') {
          setTouched(false);
        }
        draftRef.current = nextDraft;
        setDraft(nextDraft);

        const nextCaret = start + normalized.length;
        requestAnimationFrame(() => {
          const el = inputElRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(nextCaret, nextCaret);
          } catch {
            // no-op
          }
        });
      },
      [canBeNegative, commitAndEmitBlur, draft, isEditing]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || (touched && hasError)) && !isFocused;
    const displayValue = isEditing ? draft : (!isEditing && touched && hasError ? draft : toDisplayString(value));

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly,
          value: displayValue,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
      },
      [displayValue, isReadOnly]
    );

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => latest.current.locked ?? false,
        commitCurrent: () => {
          if (latest.current.locked) return true;
          const ok = commitAndEmitBlur(inputElRef.current?.value ?? draftRef.current);
          if (!ok) return false;
          setIsFocused(false);
          gridApi.closeEditing();
          return true;
        },
        clearAndCommit: () => {
          if (latest.current.locked) return;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          setDraft('');
          // Ingen emitValueChange. Commit sker via blur/commit-pipeline:
          const ok = commitAndEmitBlur('');
          if (!ok) return;
          gridApi.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          const original = originalValueOnEditStartRef.current;
          setDraft(original);
          // Ingen emitValueChange. Cancel skal være 100% lokal.
          gridApi.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          // Accepter kun plausible start-tegn for beløb/udtryk
          if (!/^[0-9,()-]$/.test(key)) return false;
          if (key === '-' && !latest.current.canBeNegative) return false;
          const committedValue = amountValueToDraftString(latestCommittedPayloadRef.current.model, TABLE_AMOUNT_PRECISION);
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          setDraft(key);
          // Ingen emitValueChange her - vi må ikke opdatere parent under edit.
          requestAnimationFrame(() => {
            const el = inputElRef.current;
            if (!el) return;
            try {
              el.setSelectionRange(el.value.length, el.value.length);
            } catch {
              // no-op
            }
          });
          return true;
        },
        selectAll: () => {
          requestAnimationFrame(() => inputElRef.current?.select());
        },
      };
    }, [commitAndEmitBlur, gridApi]);

    const gridCellKey = `${gridCell.rowId}:${gridCell.colIndex}`;
    React.useEffect(() => {
      gridApi.registerEditor(gridCell, editorHandle);
      return () => {
        gridApi.unregisterEditor(gridCell);
      };
    // gridCellKey er en stabil streng-repræsentation af gridCell-koordinaterne.
    // gridCell er intentionelt udeladt fra dep-arrayet for at undgå re-registrering
    // ved inline object literals i caller (ny reference, samme værdier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorHandle, gridApi, gridCellKey]);

    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%', ...sx }}>
        <Tooltip title={showError ? (hasExternalError ? externalErrorText : errorMessage) : ''} arrow placement="top">
          <Box sx={{ width: '100%', height: '100%' }}>
            <InputBase
              inputRef={(el) => {
                inputElRef.current = el;
                assignRef(inputRef, el);
              }}
              autoComplete="off"
              value={displayValue}
              readOnly={isReadOnly}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onCopy={handleCopy}
              onDoubleClick={handleDoubleClick}
              placeholder={cellFocused && !isReadOnly ? '' : placeholder}
              inputProps={{
                readOnly: isReadOnly,
                tabIndex: locked ? -1 : undefined,
                inputMode: 'decimal',
                'data-mineo-grid-locked': locked ? 'true' : undefined,
                'aria-describedby': showError ? a11yErrorId : undefined,
              }}
              sx={{
                ...getTableInputRootStyles({
                  showError,
                  isLooseTable,
                  locked,
                  borderRadius: inputBorderRadius,
                  borderColor: inputBorderColor,
                }),
                ...(cellFocused ? { outline: 'none' } : {}),
                '& .MuiInputBase-input': {
                  ...getTableInputElementStyles({
                    textAlign: 'right',
                    cursor: isEditing ? 'text' : 'pointer',
                    caretColor: isEditing ? 'auto' : 'transparent',
                  }),
                },
              }}
            />
            {showError ? (
              <span id={a11yErrorId} style={visuallyHiddenStyle}>
                {hasExternalError ? externalErrorText : errorMessage}
              </span>
            ) : null}
            {value?.kind === 'expression' ? (
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
            ) : null}
          </Box>
        </Tooltip>
      </Box>
    );
  }
);

TableAmountInput.displayName = 'TableAmountInput';

export default TableAmountInput;

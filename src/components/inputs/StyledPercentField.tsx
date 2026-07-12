import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { filterPercentKeyDown } from './inputKeyFilters';
import { prefixZeroBeforeLeadingComma, trimToNumericEdgesPreserveLeadingMinus } from '../../utils/draftNormalization';
import { normalizePercentPaste } from '../../utils/inputPasteNormalization';
import { buildPercentRangeErrorMessage, formatPercentDraft, parsePercentDraftForCommit } from '../../utils/percentDraftCore';
import {
  DEFAULT_PERCENT_PLACEHOLDER,
} from '../../utils/percentInputUtils';
import { INPUT_UNIT_SUFFIX } from '../../utils/inputUnit';
import InputUnitAdornment from './InputUnitAdornment';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { assignRef } from '../../utils/refUtils';
import { getNumericBoundsConfigErrors } from '../../utils/numericFieldConfig';
import { mergeSx } from '../../utils/mergeSx';

export type StyledPercentFieldValueChangeEvent = CommitEvent<number | undefined>;
export type StyledPercentFieldDraftChangeEvent = DraftChangeEvent;

export type StyledPercentFieldProps = {
  value: number | undefined;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  disabledAppearance?: 'default' | 'locked';

  allowNegative?: boolean;
  allowDecimals?: boolean;
  minValue?: number;
  maxValue?: number;
  /**
   * Når sand er intervallet en commit-grænse: værdier udenfor bliver en
   * blokerende invalid draft. Ellers er intervallet kun en visuel fejl.
   *
   * Default er `true`, så et tal uden for intervallet afvises straks i feltet og aldrig
   * når ind i beregningen — ensartet med heltals-, beløbs- og tabelcelle-felterne. Det er
   * den kanoniske måde at afvise en ugyldig værdi med rød ring + tooltip.
   *
   * Et UI-interval må bevidst være snævrere end schema-grænsen, netop for at afvise en værdi
   * som schemaet ellers ville tillade: méngrad-feltet og "Forlig om ansvarsgrad" bruger begge
   * `minValue={1}` (mens schemaet tillader 0) for at blokere 0 % i feltet. Behold `true` her —
   * det er ønsket, at feltet aldrig committer den værdi. Sæt kun `false`, hvis det snævrere
   * interval skal være en ren visuel, IKKE-blokerende advarsel (via `getVisualError`), dvs.
   * hvor værdien fortsat må committes.
   *
   * Bemærk: en blokerende invalid draft (dette default) eksponeres centralt som en blokerende
   * feltfejl (`invalid-draft`-source i formPersistenceReadModel), så den — præcis som en committet
   * ugyldig værdi — blokerer sidens beregning/download og vises i fanens "Fejl og advarsler"-boks.
   */
  enforceRange?: boolean;
  /**
   * Range-begrænsning (inklusiv).
   *
   * Default-interval er forbudt med mindre det eksplicit slås til via `useDefaultPercentRange`.
   */
  useDefaultPercentRange?: boolean;

  /**
   * Valgfri: fryser input-grammatikken uafhængigt af `minValue`/`maxValue`.
   *
   * Styrer hvor mange heltalscifre der accepteres (ekskl. tusindtalsseparatorer).
   * Skal være et heltal mellem 1 og 18.
   */
  maxIntegerDigits?: number;

  /**
   * Draft-callback (kun typing).
   */
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<number | undefined>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Valgfri ref til selve `<input>` (fx til fokusering ved fejl). Merges med feltets interne ref.
   */
  inputRef?: React.Ref<HTMLInputElement>;

  /**
   * Callback for den aktuelle fejlbesked (til forælderens validation gating)
   */
  onFieldError?: FieldErrorReporter;

  error?: boolean;
  helperText?: string;

  sx?: SxProps<Theme>;
};

const StyledPercentField = React.forwardRef<HTMLDivElement, StyledPercentFieldProps>(
  (
    {
      value,
      name,
      width = 100,
      placeholder = DEFAULT_PERCENT_PLACEHOLDER,
      disabled,
      disabledAppearance = 'default',
      allowNegative = false,
      allowDecimals = true,
      minValue,
      maxValue,
      enforceRange = true,
      useDefaultPercentRange = false,
      maxIntegerDigits: maxIntegerDigitsProp,
      onDraftChange,
      onCommit,
      onFocus,
      onBlur,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      sx,
      onFieldError,
      inputRef,
    },
    ref
  ) => {
    const configErrorMessage = React.useMemo(() => {
      if (!useDefaultPercentRange && minValue === undefined && maxValue === undefined) {
        return 'Ugyldig konfiguration: angiv minValue/maxValue eller useDefaultPercentRange';
      }

      const boundsError = getNumericBoundsConfigErrors({ minValue, maxValue, allowNegative })[0];
      if (boundsError !== undefined) return boundsError;
      const effectiveMin = typeof minValue === 'number' ? minValue : useDefaultPercentRange ? 0 : undefined;
      const effectiveMax = typeof maxValue === 'number' ? maxValue : useDefaultPercentRange ? 100 : undefined;
      const resolvedBoundsError = getNumericBoundsConfigErrors({ minValue: effectiveMin, maxValue: effectiveMax })[0];
      if (resolvedBoundsError !== undefined) return resolvedBoundsError;
      if (maxIntegerDigitsProp !== undefined) {
        if (!Number.isFinite(maxIntegerDigitsProp)) return 'Ugyldig konfiguration: maxIntegerDigits skal være et tal';
        if (!Number.isInteger(maxIntegerDigitsProp)) return 'Ugyldig konfiguration: maxIntegerDigits skal være et heltal';
        if (maxIntegerDigitsProp < 1 || maxIntegerDigitsProp > 18) {
          return 'Ugyldig konfiguration: maxIntegerDigits skal være mellem 1 og 18';
        }
      }
      return '';
    }, [allowNegative, maxIntegerDigitsProp, maxValue, minValue, useDefaultPercentRange]);

    const resolvedRange = React.useMemo(() => {
      const effectiveMin = typeof minValue === 'number' ? minValue : useDefaultPercentRange ? 0 : undefined;
      const effectiveMax = typeof maxValue === 'number' ? maxValue : useDefaultPercentRange ? 100 : undefined;
      return { effectiveMin, effectiveMax };
    }, [maxValue, minValue, useDefaultPercentRange]);

    const maxIntegerDigitsRangeErrorMessage = React.useMemo(() => {
      const maxAbs = Math.max(
        Math.abs(resolvedRange.effectiveMin ?? 0),
        Math.abs(resolvedRange.effectiveMax ?? 0)
      );
      if (!Number.isFinite(maxAbs)) return '';
      const requiredDigitsByRange = Math.max(1, Math.floor(maxAbs).toString().length);
      if (requiredDigitsByRange > 18) {
        return `Ugyldig konfiguration: min/maxValue kræver mere end 18 cifre (kræver ${requiredDigitsByRange})`;
      }
      if (
        typeof maxIntegerDigitsProp === 'number' &&
        Number.isFinite(maxIntegerDigitsProp) &&
        Number.isInteger(maxIntegerDigitsProp) &&
        maxIntegerDigitsProp < requiredDigitsByRange
      ) {
        return `Ugyldig konfiguration: maxIntegerDigits er for lille til min/maxValue (kræver mindst ${requiredDigitsByRange})`;
      }
      return '';
    }, [maxIntegerDigitsProp, resolvedRange.effectiveMax, resolvedRange.effectiveMin]);

    const resolvedConfigErrorMessage =
      configErrorMessage.trim() !== '' ? configErrorMessage : maxIntegerDigitsRangeErrorMessage;

    const hasConfigError = resolvedConfigErrorMessage.trim() !== '';

    if (import.meta.env.DEV && hasConfigError) {
      throw new Error(resolvedConfigErrorMessage);
    }

    const effectiveMaxIntegerDigits = React.useMemo(() => {
      if (typeof maxIntegerDigitsProp === 'number') return maxIntegerDigitsProp;
      const maxAbs = Math.max(
        Math.abs(resolvedRange.effectiveMin ?? 0),
        Math.abs(resolvedRange.effectiveMax ?? 0)
      );
      if (!Number.isFinite(maxAbs)) return 3;
      return Math.max(1, Math.floor(maxAbs).toString().length);
    }, [maxIntegerDigitsProp, resolvedRange.effectiveMax, resolvedRange.effectiveMin]);

    const maxLength =
      effectiveMaxIntegerDigits +
      (allowDecimals ? 3 : 0) +
      (allowNegative ? 1 : 0); // [-]iiii[,dd]

    type PercentDisplayFormat = Readonly<{ value: number | undefined; decimals: 0 | 1 | 2 }>;
    const lastCommittedDisplayRef = React.useRef<PercentDisplayFormat | null>(null);
    const pendingCommitDecimalsRef = React.useRef<0 | 1 | 2>(allowDecimals ? 2 : 0);

    const normalizePercentValueForIdentity = React.useCallback((v: number | undefined): number | undefined => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
      return v === 0 ? 0 : v;
    }, []);

    React.useEffect(() => {
      const last = lastCommittedDisplayRef.current;
      if (!last) return;
      const lastValue = normalizePercentValueForIdentity(last.value);
      const currentValue = normalizePercentValueForIdentity(value);
      if (!Object.is(lastValue, currentValue)) {
        lastCommittedDisplayRef.current = null;
      }
    }, [normalizePercentValueForIdentity, value]);

    const formatPercent = React.useCallback((v: number | undefined): string => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return '';

      const last = lastCommittedDisplayRef.current;
      const normalized = normalizePercentValueForIdentity(v);
      if (last && Object.is(normalizePercentValueForIdentity(last.value), normalized)) {
        const decimals = last.decimals;
        if (decimals === 0) return String(Math.trunc(v));
        return formatPercentDraft(v, decimals);
      }

      return formatPercentDraft(v, allowDecimals ? 2 : 0);
    }, [allowDecimals, normalizePercentValueForIdentity]);

    const parsePercent: DraftParse<number | undefined> = React.useCallback(
      (draft) => {
        const invalid = (message: string) => ({ ok: false, kind: 'invalid', message } as const);

        if (draft.trim().length > maxLength) return invalid('Ugyldig procent');

        const result = parsePercentDraftForCommit(draft, {
          allowNegative,
          allowDecimals,
          minValue: enforceRange ? resolvedRange.effectiveMin : undefined,
          maxValue: enforceRange ? resolvedRange.effectiveMax : undefined,
        });
        if (!result.ok) return invalid(result.errorMessage);

        const [, decimalPart] = draft.trim().replace(/\s+/g, '').split(',') as [string, string | undefined];
        const decimals = allowDecimals
          ? decimalPart?.length === 2
            ? 2
            : decimalPart?.length === 1
              ? 1
              : 0
          : 0;
        pendingCommitDecimalsRef.current = decimals;
        return { ok: true, value: result.value };
      },
      [
        allowDecimals,
        allowNegative,
        enforceRange,
        maxLength,
        resolvedRange.effectiveMax,
        resolvedRange.effectiveMin,
      ]
    );

    const getVisualError = React.useCallback(
      (committedValue: number | undefined): string => {
        if (committedValue === undefined) return '';
        return buildPercentRangeErrorMessage(committedValue, {
          minValue: resolvedRange.effectiveMin,
          maxValue: resolvedRange.effectiveMax,
          allowDecimals,
        }) ?? '';
      },
      [allowDecimals, resolvedRange.effectiveMax, resolvedRange.effectiveMin]
    );

    const getDraftForKey = React.useCallback(
      (key: string): string | null => {
        const mapped = key === '.' ? ',' : key;
        if (allowDecimals) {
          if (/^[0-9,]$/.test(mapped)) return mapped;
          return null;
        }
        if (/^[0-9]$/.test(mapped)) return mapped;
        return null;
      },
      [allowDecimals]
    );

    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterPercentKeyDown(e, {
          allowNegative,
          maxIntegerDigits: effectiveMaxIntegerDigits,
          allowDecimals,
        }),
      [allowDecimals, allowNegative, effectiveMaxIntegerDigits]
    );

    const {
      draft,
      isEditorOpen,
      error,
      visualErrorMessage,
      inputElementRef,
      handleDraftChange,
      handleFocus,
      handleKeyDown,
      handlePaste,
      handleBlur,
      handleMouseDown,
      handleClick,
    } = useStyledFieldAdapter<number | undefined>({
      value,
      format: formatPercent,
      parse: parsePercent,
      normalizeDraftOnCommit: (draft) => prefixZeroBeforeLeadingComma(trimToNumericEdgesPreserveLeadingMinus(draft)),
      getDraftForKey,
      normalizePasteText: (text) => normalizePercentPaste(text, {
        maxIntegerDigits: effectiveMaxIntegerDigits,
      }),
      onCommit: (nextValue) => {
        const committed = onCommit?.(createCommitEvent(nextValue)) ?? true;
        if (!committed) return false;
        lastCommittedDisplayRef.current = { value: nextValue, decimals: pendingCommitDecimalsRef.current };
        return true;
      },
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      getVisualError: enforceRange ? undefined : getVisualError,
      onFocus,
      onBlur,
      onKeyDown,
      disabled,
      blocked: hasConfigError,
      keyFilter,
      escapeRevertsToFormatted: true,
    });

    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputElementRef, inputRef]
    );

    // Parse-fejl persisteres i invalidDrafts via useStyledFieldAdapter og vises afledt herfra.
    const visibleLocalError = error;
    const resolvedHasError = hasConfigError || externalHasError || Boolean(visibleLocalError?.message) || visualErrorMessage !== '';
    const resolvedErrorMessage = hasConfigError
      ? resolvedConfigErrorMessage
      : externalHasError
        ? externalHelperText
        : visibleLocalError?.message ?? visualErrorMessage;

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={draft}
        onDraftChange={handleDraftChange}
        inputRef={assignInputRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onPaste={handlePaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled || hasConfigError}
        disabledAppearance={disabledAppearance}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        endAdornment={
          <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={draft.trim() === ''} />
        }
        htmlInputAttributes={{
          inputMode: allowDecimals ? 'decimal' : 'numeric',
          maxLength,
          readOnly: !isEditorOpen,
        }}
        sx={mergeSx({
          '& .MuiInputBase-input': {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            caretColor: isEditorOpen ? 'auto' : 'transparent',
            cursor: isEditorOpen ? 'text' : 'pointer',
          },
        }, sx)}
      />
    );
  }
);

StyledPercentField.displayName = 'StyledPercentField';

export default StyledPercentField;

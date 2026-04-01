import React from 'react';
import { useFormPersistence } from '../contexts/useFormPersistence';

const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

export const useEOLoenindkomstInputErrors = (): Readonly<Record<string, true>> => {
  const { getFieldErrorsBySource } = useFormPersistence();

  return React.useMemo(() => {
    const fieldErrors = getFieldErrorsBySource('erstatningsopgoerelse');
    const result: Record<string, true> = {};

    for (const [fieldKey, bySource] of Object.entries(fieldErrors)) {
      if (!fieldKey.endsWith(EO_LOENINDKOMST_INPUT_ERROR_SUFFIX) || !bySource) continue;
      const hasBlockingError = Object.values(bySource).some((entry) => entry?.severity === 'error' && entry.blocksSave !== false);
      if (!hasBlockingError) continue;
      const ansaettelsesforholdId = fieldKey.slice(0, -EO_LOENINDKOMST_INPUT_ERROR_SUFFIX.length);
      if (ansaettelsesforholdId !== '') {
        result[ansaettelsesforholdId] = true;
      }
    }

    return result;
  }, [getFieldErrorsBySource]);
};

export const useSetEOLoenindkomstInputError = (): ((ansaettelsesforholdId: string, hasError: boolean) => void) => {
  const { setFieldError } = useFormPersistence();

  return React.useCallback((ansaettelsesforholdId: string, hasError: boolean) => {
    const fieldKey = `${ansaettelsesforholdId}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`;
    setFieldError(
      'erstatningsopgoerelse',
      fieldKey,
      'input',
      hasError ? { message: 'Ugyldig manuel regulering', severity: 'error', blocksSave: true } : null
    );
  }, [setFieldError]);
};

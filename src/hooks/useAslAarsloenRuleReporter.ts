import React from 'react';
import { amountValueToNumber } from '../utils/expressionAmount';
import {
  validateAslAarsloenBySkadesaarMax,
  validateAslAarsloenDivisibleBy1000,
} from '../domain/aslEalAarsloen/aarsloenValidators';
import { useFormFieldErrorReporter } from './useFormFieldErrors';
import type { FaellesAarsloenValues } from '../schemas/formSchemas';
import type { ISODateString } from '../types/branded';

export const useAslAarsloenRuleReporter = (
  aslAarsloen: FaellesAarsloenValues['aslAarsloen'],
  skadedato: ISODateString | undefined
): string | undefined => {
  const reportAslAarsloenRuleError = useFormFieldErrorReporter('faellesAarsloen', 'aslAarsloen', {
    severity: 'error',
    source: 'rule',
  });

  const aslAarsloenRuleError = React.useMemo(() => {
    const aarsloen = amountValueToNumber(aslAarsloen);
    const divisibleBy1000Error = validateAslAarsloenDivisibleBy1000(aarsloen);
    if (divisibleBy1000Error) return divisibleBy1000Error;
    return validateAslAarsloenBySkadesaarMax(aarsloen, skadedato);
  }, [aslAarsloen, skadedato]);

  React.useEffect(() => {
    reportAslAarsloenRuleError(aslAarsloenRuleError);
  }, [aslAarsloenRuleError, reportAslAarsloenRuleError]);

  return aslAarsloenRuleError;
};

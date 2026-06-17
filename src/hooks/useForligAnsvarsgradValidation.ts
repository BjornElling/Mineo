import React from 'react';
import {
  evaluateForligAnsvarsgradRules,
  type ForligAnsvarsgradFields,
} from '../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';
import { useFormFieldErrorReporter } from './useFormFieldErrors';

export type ForligFejl = Readonly<{
  harFejl: boolean;
  fejlbesked: string;
}>;

/**
 * Delt forligs-validering for de tre forligs-felter, der deles mellem Erstatningsopgørelse og
 * Erhvervsevnetab -> Differencekrav (jf. domain-boundary-contract.md §10).
 *
 * Hooken er den ene fælles enhed, begge faner bruger: den rapporterer de to blokerende regler til den
 * centrale fejl-model under pageKey `erstatningsopgoerelse` (samme felter og `source:'rule'` som før),
 * og returnerer den visuelle "begge udfyldt"-fejl, der driver rød ring + tooltip på procent/brøk-felterne.
 *
 * Reporterne rydder ikke på unmount (jf. useFormFieldErrorReporter): de to faner ligger på hver sin route
 * og er aldrig monteret samtidig, så der opstår ingen dobbeltrapportering. Når en regel ikke længere er
 * overtrådt, rydder hooken aktivt sin egen `source:'rule'`-fejl igen.
 *
 * Validerer kun på committede værdier (ingen draft-state).
 */
export const useForligAnsvarsgradValidation = (committedForligValues: ForligAnsvarsgradFields): ForligFejl => {
  const reportForligAnsvarsgradProcentRuleError = useFormFieldErrorReporter(
    'erstatningsopgoerelse',
    'forligAnsvarsgradProcent',
    { severity: 'error', source: 'rule' }
  );
  const reportForligAnsvarsgradBroekRuleError = useFormFieldErrorReporter(
    'erstatningsopgoerelse',
    'forligAnsvarsgradBroek',
    { severity: 'error', source: 'rule' }
  );
  const reportForligDatoRuleError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligDato', {
    severity: 'error',
    source: 'rule',
  });

  // Memoiser på de tre primitive felter (ikke objekt-identitet), så et nyt objekt pr. render ikke
  // udløser unødig re-evaluering/rapportering.
  const { forligAnsvarsgradProcent, forligAnsvarsgradBroek, forligDato } = committedForligValues;
  const evaluation = React.useMemo(
    () => evaluateForligAnsvarsgradRules({ forligAnsvarsgradProcent, forligAnsvarsgradBroek, forligDato }),
    [forligAnsvarsgradProcent, forligAnsvarsgradBroek, forligDato]
  );

  React.useEffect(() => {
    reportForligAnsvarsgradProcentRuleError(evaluation.beggeUdfyldtFejl);
    reportForligAnsvarsgradBroekRuleError(evaluation.beggeUdfyldtFejl);
  }, [evaluation.beggeUdfyldtFejl, reportForligAnsvarsgradBroekRuleError, reportForligAnsvarsgradProcentRuleError]);

  React.useEffect(() => {
    reportForligDatoRuleError(evaluation.forligDatoFejl);
  }, [evaluation.forligDatoFejl, reportForligDatoRuleError]);

  return React.useMemo(
    () => ({
      harFejl: evaluation.beggeUdfyldt,
      fejlbesked: evaluation.beggeUdfyldtFejl ?? '',
    }),
    [evaluation.beggeUdfyldt, evaluation.beggeUdfyldtFejl]
  );
};

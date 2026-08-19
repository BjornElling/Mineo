import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

/**
 * Committede forligs-felter, der deles mellem Erstatningsopgørelse og Erhvervsevnetab -> Differencekrav
 * (jf. domain-boundary-contract.md §10). Reglerne her er den eneste sandhedskilde for de to blokerende
 * forligs-regler, så begge faner håndhæver præcis det samme.
 */
export type ForligAnsvarsgradFields = Pick<
  ErstatningsopgoerelseValues,
  'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek' | 'forligDato'
>;

/**
 * Brugervendte regelbeskeder. Holdes samlet her, så ordlyden kun findes ét sted.
 */
export const FORLIG_BEGGE_UDFYLDT_FEJL = 'Kan ikke udfylde både procent og brøk';
export const FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL =
  'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk';

export type ForligAnsvarsgradRuleEvaluation = Readonly<{
  /** Om procent og brøk begge er udfyldt (tvetydigt forlig). */
  beggeUdfyldt: boolean;
  /** Blokerende regel-fejl for procent/brøk-felterne (eller undefined). */
  beggeUdfyldtFejl: string | undefined;
  /** Blokerende regel-fejl for forligDato-feltet (eller undefined). */
  forligDatoFejl: string | undefined;
}>;

/**
 * Evaluerer de to blokerende forligs-regler fra committede værdier:
 *  1. Procent og brøk må ikke begge være udfyldt.
 *  2. En forligsdato kræver, at ansvarsgrad er angivet som procent eller brøk.
 *
 * Ren funktion – bruger kun committed input (draft-state må ikke indgå, jf. form-contract.md).
 */
export const evaluateForligAnsvarsgradRules = (
  values: ForligAnsvarsgradFields
): ForligAnsvarsgradRuleEvaluation => {
  const hasProcent =
    typeof values.forligAnsvarsgradProcent === 'number' && Number.isFinite(values.forligAnsvarsgradProcent);
  const hasBroek = typeof values.forligAnsvarsgradBroek === 'string' && values.forligAnsvarsgradBroek.trim() !== '';
  const hasForligDato = typeof values.forligDato === 'string' && values.forligDato.trim() !== '';

  const beggeUdfyldt = hasProcent && hasBroek;
  const datoUdenAnsvarsgrad = hasForligDato && !hasProcent && !hasBroek;

  return {
    beggeUdfyldt,
    beggeUdfyldtFejl: beggeUdfyldt ? FORLIG_BEGGE_UDFYLDT_FEJL : undefined,
    forligDatoFejl: datoUdenAnsvarsgrad ? FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL : undefined,
  };
};

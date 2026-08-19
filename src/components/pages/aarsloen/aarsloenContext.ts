import React from 'react';
import { useAarsloenViewModel } from './useAarsloenViewModel';

/**
 * Årsløn-sidens viewmodel, delt med sektion-komponenterne (`page-component-contract.md` §4.4).
 *
 * Modellen eksponerer bundne field-refs, editorlokationer, det færdige beregningsresultat og dokumenthandles –
 * ingen form-settere. Sektionerne kan derfor ikke skrive uden om feltfamilien.
 */
export type AarsloenVm = ReturnType<typeof useAarsloenViewModel>;

const AarsloenVmContext = React.createContext<AarsloenVm | null>(null);

export const AarsloenVmProvider = AarsloenVmContext.Provider;

export function useAarsloenVm(): AarsloenVm {
  const vm = React.useContext(AarsloenVmContext);
  if (vm === null) {
    throw new Error('useAarsloenVm skal bruges inden for en AarsloenVmProvider');
  }
  return vm;
}

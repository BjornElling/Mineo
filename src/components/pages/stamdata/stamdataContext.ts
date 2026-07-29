import React from 'react';
import { useStamdataViewModel } from './useStamdataViewModel';

/**
 * Stamdata-sidens viewmodel, delt med sektion-komponenterne (`page-component-contract.md` §4.4).
 *
 * Modellen eksponerer kun bundne field-refs, editorlokationer og afledte labels — ingen rå `values` og ingen
 * form-settere. Sektionerne kan derfor pr. konstruktion ikke skrive uden om feltfamilien.
 */
export type StamdataVm = ReturnType<typeof useStamdataViewModel>;

const StamdataVmContext = React.createContext<StamdataVm | null>(null);

export const StamdataVmProvider = StamdataVmContext.Provider;

export function useStamdataVm(): StamdataVm {
  const vm = React.useContext(StamdataVmContext);
  if (vm === null) {
    throw new Error('useStamdataVm skal bruges inden for en StamdataVmProvider');
  }
  return vm;
}

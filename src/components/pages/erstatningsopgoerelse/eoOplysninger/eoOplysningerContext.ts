import React from 'react';
import { useEoOplysningerViewModel } from './useEoOplysningerViewModel';

/**
 * Den flade view-model som Erstatningsopgørelse-oplysninger-fanen og dens sektion-komponenter
 * deler. Konteksten fjerner prop-boring, men er fortsat en bred kanal: sektionerne læser stadig
 * rå `values` og form-settere via modellen. Det er en bevidst A1-rest, ikke samme lukkede form som
 * Lønindkomsts React-fri afledningsmodel.
 */
export type EoOplysningerVm = ReturnType<typeof useEoOplysningerViewModel>;

const EoOplysningerVmContext = React.createContext<EoOplysningerVm | null>(null);

export const EoOplysningerVmProvider = EoOplysningerVmContext.Provider;

export function useEoOplysningerVm(): EoOplysningerVm {
  const vm = React.useContext(EoOplysningerVmContext);
  if (vm === null) {
    throw new Error('useEoOplysningerVm skal bruges inden for en EoOplysningerVmProvider');
  }
  return vm;
}

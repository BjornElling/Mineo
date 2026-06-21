import React from 'react';
import { useEoOplysningerViewModel } from './useEoOplysningerViewModel';

/**
 * Den flade view-model som Erstatningsopgørelse-oplysninger-fanen og dens sektion-komponenter
 * deler. Konteksten er den smalle kanal A1 foreskriver: sektionerne forbruger modellen via
 * `useEoOplysningerVm()` i stedet for at modtage et stort antal props (ingen prop-boring).
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

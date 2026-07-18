import React from 'react';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import { useGreenfieldLoenindkomstViewModel } from './useGreenfieldLoenindkomstViewModel';

/**
 * Den flade view-model + de få side-niveau-værdier som Loenindkomst-fanen og dens
 * ansættelsesforhold-kort deler. Kortet forbruger modellen via `useLoenindkomstVm()` i stedet for
 * at modtage et stort antal props (jf. A1 — ingen prop-boring). De per-række-værdier (`af`, `index`)
 * gives fortsat som almindelige props, da de varierer pr. iteration.
 */
export type LoenindkomstVm = ReturnType<typeof useGreenfieldLoenindkomstViewModel> & Readonly<{
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  tafBeregningsperiodeTil: ErstatningsopgoerelseValues['tafBeregningsperiodeTil'];
  sfggSixMonthWarningEmploymentIds: readonly string[];
  onNavigateToTabtArbejdsfortjeneste: () => void;
}>;

const LoenindkomstVmContext = React.createContext<LoenindkomstVm | null>(null);

export const LoenindkomstVmProvider = LoenindkomstVmContext.Provider;

export function useLoenindkomstVm(): LoenindkomstVm {
  const vm = React.useContext(LoenindkomstVmContext);
  if (vm === null) {
    throw new Error('useLoenindkomstVm skal bruges inden for en LoenindkomstVmProvider');
  }
  return vm;
}

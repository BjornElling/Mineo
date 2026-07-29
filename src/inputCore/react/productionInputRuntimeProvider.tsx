import * as React from 'react';
import {
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from './inputRuntimeContext';

export type ProductionInputRuntimeProviderProps = Readonly<{
  binding: InputRuntimeBinding;
  children: React.ReactNode;
}>;

/**
 * Tynd produktions-provider. Bindingen bygges/hydreres uden for React (før render) og gives ind, så en
 * remount aldrig re-hydrerer eller overskriver input (§3.10). Adskilt fra `InputRuntimeProvider`, så
 * test-wiring og produktions-wiring ikke deler mount-ansvar.
 *
 * Komponenten ligger i sit eget modul: runtime-modulet eksporterer bootstrap-funktioner, og en blanding af
 * komponent- og funktions-exports gør Vites Fast Refresh usikker på, om en ændring kan bevares sikkert.
 */
export const ProductionInputRuntimeProvider = ({
  binding,
  children,
}: ProductionInputRuntimeProviderProps): React.ReactElement => (
  <InputRuntimeProvider binding={binding}>{children}</InputRuntimeProvider>
);

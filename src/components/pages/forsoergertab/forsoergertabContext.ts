import React from 'react';
import { useForsoergertabViewModel } from './useForsoergertabViewModel';

/**
 * Forsørgertab-sidens viewmodel, delt med sektion-komponenterne (`page-component-contract.md` §4.4).
 *
 * Modellen eksponerer bundne field-refs, editorlokationer, det færdige snapshot-resultat og dokumenthandlet —
 * ingen form-settere og ingen rå sektioner.
 */
export type ForsoergertabVm = ReturnType<typeof useForsoergertabViewModel>;

const ForsoergertabVmContext = React.createContext<ForsoergertabVm | null>(null);

export const ForsoergertabVmProvider = ForsoergertabVmContext.Provider;

export function useForsoergertabVm(): ForsoergertabVm {
  const vm = React.useContext(ForsoergertabVmContext);
  if (vm === null) {
    throw new Error('useForsoergertabVm skal bruges inden for en ForsoergertabVmProvider');
  }
  return vm;
}

import type { SelectedElements } from '../types';

export const assertNoUnsupportedSygeferiegodtgoerelseSelection = (
  selectedElements: SelectedElements
): void => {
  if (!selectedElements.sygeferiegodtgoerelse) return;
  throw new Error('Valgte PDF-elementer er ikke understøttet endnu: Sygeferiegodtgørelse.');
};


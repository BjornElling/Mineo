import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import {
  createEmptyRentekravCommittedRow,
  createRentekravRowId,
} from './rentekravTableModel';

export const createRenteberegningInitialValues = (): PersistedSectionMap['renteberegning'] => ({
  beregningsdato: undefined,
  kommentarer: undefined,
  rentekravRows: [createEmptyRentekravCommittedRow(createRentekravRowId())],
});

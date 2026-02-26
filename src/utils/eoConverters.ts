import type { AarsloenTableRow } from '../schemas/formSchemas';
import { createRowId } from '../domain/rowId';

/**
 * Initial tom række - indeholder alle periodetyper.
 *
 * VIGTIGT: `id` sættes af caller (fx `generateRowId()`), så her bruges en tom string.
 */
export const initialRow: Omit<AarsloenTableRow, 'id'> & { id: '' } = {
  id: '',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
};

export const generateRowId = (): string => createRowId('row');

/**
 * Genererer unikt ID til ansættelsesforhold baseret på timestamp
 *
 * @returns Unikt ansættelsesforhold ID
 */
export const generateAnsaettelsesforholdId = (): string => {
  return createRowId('ansaettelsesforhold');
};

/**
 * Genererer unikt ID til offentlig ydelse række
 *
 * @returns Unikt offentlig ydelse ID
 */
export const generateOffentligYdelseRowId = (): string => {
  return createRowId('offentlig_ydelse');
};

/**
 * Genererer unikt ID til lønudvikling (manuel) række
 *
 * @returns Unikt lønudvikling række-ID
 */
export const generateLoenudviklingRowId = (): string => {
  return createRowId('loenudvikling');
};

/**
 * Initial tom offentlig ydelse række
 */
export const initialOffentligYdelseRow = {
  id: '',
  fraDato: '',
  tilDato: '',
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
};

/**
 * Initial tom lønudvikling (manuel) række
 */
export const initialLoenudviklingManuelRow = {
  id: '',
  dato: '',
  grundloen: undefined,
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
};

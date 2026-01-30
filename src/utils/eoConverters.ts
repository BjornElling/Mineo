import type { AarsloenTableRow } from '../schemas/formSchemas';

/**
 * Initial tom række - indeholder alle periodetyper.
 *
 * VIGTIGT: `id` sættes af caller (fx `generateRowId()`), så her bruges en tom string.
 */
export const initialRow: Omit<AarsloenTableRow, 'id'> & { id: string } = {
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

let rowIdCounter = 0;
export const generateRowId = (): string => {
  rowIdCounter += 1;
  return `row_${Date.now()}_${rowIdCounter}`;
};

/**
 * Genererer unikt ID til ansættelsesforhold baseret på timestamp
 *
 * @returns Unikt ansættelsesforhold ID
 */
export const generateAnsaettelsesforholdId = (): string => {
  return `ansaettelsesforhold_${Date.now()}`;
};

/**
 * Genererer unikt ID til offentlig ydelse række
 *
 * @returns Unikt offentlig ydelse ID
 */
export const generateOffentligYdelseRowId = (): string => {
  rowIdCounter += 1;
  return `offentlig_ydelse_${Date.now()}_${rowIdCounter}`;
};

/**
 * Genererer unikt ID til lønudvikling (manuel) række
 *
 * @returns Unikt lønudvikling række-ID
 */
export const generateLoenudviklingRowId = (): string => {
  rowIdCounter += 1;
  return `loenudvikling_${Date.now()}_${rowIdCounter}`;
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

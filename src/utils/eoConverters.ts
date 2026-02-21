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

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const createPrefixedId = (prefix: string): string => `${prefix}_${randomId()}`;

export const generateRowId = (): string => createPrefixedId('row');

/**
 * Genererer unikt ID til ansættelsesforhold baseret på timestamp
 *
 * @returns Unikt ansættelsesforhold ID
 */
export const generateAnsaettelsesforholdId = (): string => {
  return createPrefixedId('ansaettelsesforhold');
};

/**
 * Genererer unikt ID til offentlig ydelse række
 *
 * @returns Unikt offentlig ydelse ID
 */
export const generateOffentligYdelseRowId = (): string => {
  return createPrefixedId('offentlig_ydelse');
};

/**
 * Genererer unikt ID til lønudvikling (manuel) række
 *
 * @returns Unikt lønudvikling række-ID
 */
export const generateLoenudviklingRowId = (): string => {
  return createPrefixedId('loenudvikling');
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

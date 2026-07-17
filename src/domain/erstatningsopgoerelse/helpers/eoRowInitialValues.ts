import type { LoenudviklingManuelProcentsatsRow, LoenudviklingManuelRow, OffentligeYdelserRow, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { createRowId } from '../../../utils/rowId';
import { createEmptyStandardLoenRow } from '../../aarsloen/standardLoenRowInitialValues';

/**
 * Initial tom række - indeholder alle periodetyper.
 *
 * VIGTIGT: `id` sættes af caller (fx `generateRowId()`), så her bruges en tom string.
 */
export const initialRow: Omit<StandardLoenTableRow, 'id'> & { id: '' } = createEmptyStandardLoenRow('');

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
 *
 * VIGTIGT: `id` sættes af caller, så her bruges en tom string. Den eksplicitte type
 * binder feltsættet til schemaet, så en schema-ændring fail-closed giver en typefejl her
 * frem for stille at efterlade rækken uden et nyt/omdøbt felt.
 */
export const initialOffentligYdelseRow: Omit<OffentligeYdelserRow, 'id'> & { id: '' } = {
  id: '',
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
};

/**
 * Initial tom lønudvikling (manuel) række
 *
 * VIGTIGT: `id` sættes af caller, så her bruges en tom string. Den eksplicitte type
 * binder feltsættet til schemaet, jf. `initialOffentligYdelseRow`.
 */
export const initialLoenudviklingManuelRow: Omit<LoenudviklingManuelRow, 'id'> & { id: '' } = {
  id: '',
  dato: undefined,
  grundloen: undefined,
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
};

/**
 * Initial tom lønudvikling (manuel procentsats) række.
 */
export const initialLoenudviklingManuelProcentsatsRow: Omit<LoenudviklingManuelProcentsatsRow, 'id'> & { id: '' } = {
  id: '',
  dato: undefined,
  procent: undefined,
};

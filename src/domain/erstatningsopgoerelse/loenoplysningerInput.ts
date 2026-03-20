import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { isStandardLoenTableValueEffectivelyEmptyForValidation } from '../aarsloen/standardLoenTableValidation';

const AMOUNT_KEYS: ReadonlyArray<keyof StandardLoenTableRow> = ['col2', 'col3', 'col4', 'col5'];

export const hasIndtastetLoenoplysninger = (rows: readonly StandardLoenTableRow[]): boolean => {
  return rows.some((row) => AMOUNT_KEYS.some((key) => !isStandardLoenTableValueEffectivelyEmptyForValidation(row[key])));
};

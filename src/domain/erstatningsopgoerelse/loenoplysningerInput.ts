import type { AarsloenTableRow } from '../../schemas/formSchemas';
import { isAarsloenTableValueEffectivelyEmptyForValidation } from '../aarsloen/aarsloenTableValidation';

const AMOUNT_KEYS: ReadonlyArray<keyof AarsloenTableRow> = ['col2', 'col3', 'col4', 'col5'];

export const hasIndtastetLoenoplysninger = (rows: readonly AarsloenTableRow[]): boolean => {
  return rows.some((row) => AMOUNT_KEYS.some((key) => !isAarsloenTableValueEffectivelyEmptyForValidation(row[key])));
};

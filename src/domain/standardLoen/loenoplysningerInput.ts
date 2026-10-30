import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { isStandardLoenTableValueEffectivelyEmptyForValidation } from './standardLoenTableValidation';

const AMOUNT_KEYS: ReadonlyArray<keyof StandardLoenTableRow> = ['col2', 'col3', 'col4', 'col5'];

/**
 * Om løntabellen har mindst ét indtastet beløb. Delt af Årsløn og EO's ansættelsesforhold, fordi begge flader
 * bruger samme løntabel og samme svar på «er der lønoplysninger?» (fx feriesatsens krav, `domain/loen/feriePctKrav.ts`).
 */
export const hasIndtastetLoenoplysninger = (rows: readonly StandardLoenTableRow[]): boolean => {
  return rows.some((row) => AMOUNT_KEYS.some((key) => !isStandardLoenTableValueEffectivelyEmptyForValidation(row[key])));
};

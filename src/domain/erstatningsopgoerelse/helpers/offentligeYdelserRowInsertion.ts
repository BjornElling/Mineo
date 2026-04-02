import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { getOffentligeYdelserRowFilledState } from '../validation/offentligeYdelserTableValidation';

export const insertOffentligeYdelserRowsBeforeTrailingEmpty = (
  existingRows: readonly OffentligeYdelserRow[],
  insertedRows: readonly OffentligeYdelserRow[]
): OffentligeYdelserRow[] => {
  if (insertedRows.length === 0) return [...existingRows];

  let insertIndex = existingRows.length;
  while (insertIndex > 0 && !getOffentligeYdelserRowFilledState(existingRows[insertIndex - 1]).hasAnyFilled) {
    insertIndex -= 1;
  }

  return [
    ...existingRows.slice(0, insertIndex),
    ...insertedRows,
    ...existingRows.slice(insertIndex),
  ];
};

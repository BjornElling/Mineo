export const ensureRowsWithTrailingEmpty = <TRow,>(
  rows: readonly TRow[],
  isEmpty: (row: TRow) => boolean,
  createEmptyRow: () => TRow
): TRow[] => {
  const nonEmptyRows = rows.filter((row) => !isEmpty(row));

  let trailingEmptyRow: TRow | undefined;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (isEmpty(rows[i])) {
      trailingEmptyRow = rows[i];
      break;
    }
  }

  const emptyRow = trailingEmptyRow ?? createEmptyRow();
  return nonEmptyRows.length === 0 ? [emptyRow] : [...nonEmptyRows, emptyRow];
};


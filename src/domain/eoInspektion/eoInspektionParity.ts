import { normalizeCsvHeader, toCsvScalar } from './csvUtils';
import { hashInspektionValue } from './eoInspektionHash';

export type KontrolTableParityDiff = Readonly<{
  rowIndex: number;
  colId: string;
  expectedHash: string;
  actualHash: string;
}>;

type KontrolTableColumnLike = Readonly<{
  id: string;
  header: string;
  getCell: (rowIndex: number) => unknown;
}>;

type KontrolTableModelLike = Readonly<{
  columns: readonly KontrolTableColumnLike[];
  rowCount: number;
  getRowKey: (rowIndex: number) => string;
}>;

const hash = (value: string): string => hashInspektionValue(value);

const diff = (rowIndex: number, colId: string, expected: string, actual: string): KontrolTableParityDiff => ({
  rowIndex,
  colId,
  expectedHash: hash(expected),
  actualHash: hash(actual),
});

export const findFirstKontrolTableParityDiff = (
  expected: KontrolTableModelLike,
  actual: KontrolTableModelLike
): KontrolTableParityDiff | null => {
  if (expected.columns.length !== actual.columns.length) {
    return diff(-1, 'meta:column-count', String(expected.columns.length), String(actual.columns.length));
  }

  for (let i = 0; i < expected.columns.length; i += 1) {
    const expectedCol = expected.columns[i];
    const actualCol = actual.columns[i];
    if (expectedCol.id !== actualCol.id) {
      return diff(-1, `meta:column-id:${i}`, expectedCol.id, actualCol.id);
    }
  }

  for (let i = 0; i < expected.columns.length; i += 1) {
    const expectedCol = expected.columns[i];
    const actualCol = actual.columns[i];
    const expectedHeader = normalizeCsvHeader(expectedCol.header);
    const actualHeader = normalizeCsvHeader(actualCol.header);
    if (expectedHeader !== actualHeader) {
      return diff(-1, expectedCol.id, expectedHeader, actualHeader);
    }
  }

  if (expected.rowCount !== actual.rowCount) {
    return diff(-1, 'meta:row-count', String(expected.rowCount), String(actual.rowCount));
  }

  for (let rowIndex = 0; rowIndex < expected.rowCount; rowIndex += 1) {
    const expectedKey = expected.getRowKey(rowIndex);
    const actualKey = actual.getRowKey(rowIndex);
    if (expectedKey !== actualKey) {
      return diff(rowIndex, 'meta:row-key', expectedKey, actualKey);
    }
  }

  for (let rowIndex = 0; rowIndex < expected.rowCount; rowIndex += 1) {
    for (let colIndex = 0; colIndex < expected.columns.length; colIndex += 1) {
      const col = expected.columns[colIndex];
      const expectedValue = toCsvScalar(col.getCell(rowIndex));
      const actualValue = toCsvScalar(actual.columns[colIndex]?.getCell(rowIndex));
      if (expectedValue !== actualValue) {
        return diff(rowIndex, col.id, expectedValue, actualValue);
      }
    }
  }

  return null;
};

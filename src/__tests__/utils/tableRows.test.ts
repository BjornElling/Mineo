import { ensureRowsWithTrailingEmpty } from '../../utils/tableRows';

type Row = Readonly<{ id: string; value: string }>;

const isEmpty = (row: Row): boolean => row.value === '';
let counter = 0;
const createEmptyRow = (): Row => ({ id: `empty_${(counter += 1)}`, value: '' });

describe('ensureRowsWithTrailingEmpty', () => {
  beforeEach(() => {
    counter = 0;
  });

  it('tomt input → én ny tom række', () => {
    const result = ensureRowsWithTrailingEmpty<Row>([], isEmpty, createEmptyRow);
    expect(result).toHaveLength(1);
    expect(isEmpty(result[0])).toBe(true);
  });

  it('kun ikke-tomme rækker → tilføjer trailing tom række', () => {
    const rows: Row[] = [
      { id: '1', value: 'a' },
      { id: '2', value: 'b' },
    ];
    const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmptyRow);
    expect(result).toHaveLength(3);
    expect(result.slice(0, 2)).toEqual(rows);
    expect(isEmpty(result[2])).toBe(true);
  });

  it('eksisterende trailing tom række genbruges (samme reference)', () => {
    const emptyRow: Row = { id: 'existing-empty', value: '' };
    const rows: Row[] = [{ id: '1', value: 'a' }, emptyRow];
    const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmptyRow);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(emptyRow);
    expect(counter).toBe(0); // createEmptyRow ikke kaldt
  });

  it('flere tomme rækker kollapses til én (den sidste tomme bevares)', () => {
    const lastEmpty: Row = { id: 'last-empty', value: '' };
    const rows: Row[] = [
      { id: 'e1', value: '' },
      { id: '1', value: 'a' },
      lastEmpty,
    ];
    const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmptyRow);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '1', value: 'a' });
    expect(result[1]).toBe(lastEmpty);
  });

  it('bevarer rækkefølgen af ikke-tomme rækker', () => {
    const rows: Row[] = [
      { id: '1', value: 'c' },
      { id: '2', value: 'a' },
      { id: '3', value: 'b' },
    ];
    const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmptyRow);
    expect(result.slice(0, 3).map((r) => r.value)).toEqual(['c', 'a', 'b']);
  });
});

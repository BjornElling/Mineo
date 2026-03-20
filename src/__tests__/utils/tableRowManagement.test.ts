import { ensureRowsWithTrailingEmpty } from '../../utils/tableRows';

// ─── Test setup ───────────────────────────────────────────────────────────

type TestRow = { id: string; value?: number };

const isEmpty = (row: TestRow): boolean => row.value === undefined;
const createEmpty = (): TestRow => ({ id: `empty_${Math.random()}` });

// ─── ensureRowsWithTrailingEmpty ──────────────────────────────────────────

describe('ensureRowsWithTrailingEmpty', () => {
  describe('tom liste', () => {
    it('tom liste → liste med én tom række', () => {
      const result = ensureRowsWithTrailingEmpty([], isEmpty, createEmpty);
      expect(result).toHaveLength(1);
      expect(isEmpty(result[0])).toBe(true);
    });
  });

  describe('kun tomme rækker', () => {
    it('én tom række → liste med samme tomme række', () => {
      const emptyRow: TestRow = { id: 'original_empty' };
      const result = ensureRowsWithTrailingEmpty([emptyRow], isEmpty, createEmpty);
      expect(result).toHaveLength(1);
      // Den eksisterende tomme række genbruges
      expect(result[0].id).toBe('original_empty');
    });

    it('to tomme rækker → liste med én tom række (den sidste)', () => {
      const rows: TestRow[] = [{ id: 'e1' }, { id: 'e2' }];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e2'); // Beholder den SIDSTE tomme
    });
  });

  describe('ikke-tomme rækker', () => {
    it('én ikke-tom række → tilføjer trailing tom', () => {
      const rows: TestRow[] = [{ id: 'r1', value: 42 }];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'r1', value: 42 });
      expect(isEmpty(result[1])).toBe(true);
    });

    it('tre ikke-tomme rækker → tilføjer trailing tom', () => {
      const rows: TestRow[] = [
        { id: 'r1', value: 1 },
        { id: 'r2', value: 2 },
        { id: 'r3', value: 3 },
      ];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      expect(result).toHaveLength(4);
      expect(result[0].value).toBe(1);
      expect(result[1].value).toBe(2);
      expect(result[2].value).toBe(3);
      expect(isEmpty(result[3])).toBe(true);
    });
  });

  describe('blanding af tomme og ikke-tomme', () => {
    it('ikke-tom + tom → beholder kun ikke-tom + én trailing tom', () => {
      const rows: TestRow[] = [
        { id: 'r1', value: 10 },
        { id: 'e1' }, // tom
      ];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(10);
      expect(isEmpty(result[1])).toBe(true);
      expect(result[1].id).toBe('e1'); // Genbruger den eksisterende tomme
    });

    it('tom midt i liste filtreres ud', () => {
      const rows: TestRow[] = [
        { id: 'r1', value: 10 },
        { id: 'e1' }, // tom — filtreres ud
        { id: 'r2', value: 20 },
        { id: 'e2' }, // trailing tom
      ];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      expect(result).toHaveLength(3); // r1, r2, trailing empty
      expect(result[0].value).toBe(10);
      expect(result[1].value).toBe(20);
      expect(isEmpty(result[2])).toBe(true);
      expect(result[2].id).toBe('e2'); // Beholder den SIDSTE tomme
    });

    it('genbruger eksisterende trailing tom frem for at skabe ny', () => {
      const existingEmpty: TestRow = { id: 'existing_empty' };
      const rows: TestRow[] = [{ id: 'r1', value: 5 }, existingEmpty];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      // Den eksisterende tomme fra rækken bruges
      expect(result[result.length - 1].id).toBe('existing_empty');
    });
  });

  describe('rækkefølge bevares', () => {
    it('ikke-tomme rækker bevarer rækkefølge', () => {
      const rows: TestRow[] = [
        { id: 'r3', value: 30 },
        { id: 'r1', value: 10 },
        { id: 'r2', value: 20 },
      ];
      const result = ensureRowsWithTrailingEmpty(rows, isEmpty, createEmpty);
      expect(result[0].id).toBe('r3');
      expect(result[1].id).toBe('r1');
      expect(result[2].id).toBe('r2');
    });
  });
});

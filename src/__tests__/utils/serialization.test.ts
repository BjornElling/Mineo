import { serializeFormValues } from '../../utils/serialization';

describe('serializeFormValues', () => {
  describe('primitive typer', () => {
    it('string bevares', () => {
      const result = serializeFormValues({ a: 'hello' });
      expect(result.a).toBe('hello');
    });

    it('number bevares', () => {
      const result = serializeFormValues({ n: 42 });
      expect(result.n).toBe(42);
    });

    it('boolean bevares', () => {
      const result = serializeFormValues({ b: true });
      expect(result.b).toBe(true);
    });

    it('null bevares', () => {
      const result = serializeFormValues({ x: null });
      expect(result.x).toBeNull();
    });
  });

  describe('undefined → null konvertering', () => {
    it('undefined top-level → null', () => {
      const result = serializeFormValues({ missing: undefined });
      expect(result.missing).toBeNull();
    });

    it('undefined i nested objekt → null', () => {
      const result = serializeFormValues({ obj: { a: undefined } });
      expect((result.obj as Record<string, unknown>).a).toBeNull();
    });

    it('undefined i array → null', () => {
      const result = serializeFormValues({ arr: [undefined, 1, undefined] });
      expect(result.arr).toEqual([null, 1, null]);
    });
  });

  describe('arrays', () => {
    it('simpelt array bevares', () => {
      const result = serializeFormValues({ arr: [1, 2, 3] });
      expect(result.arr).toEqual([1, 2, 3]);
    });

    it('array med mixed typer', () => {
      const result = serializeFormValues({ arr: [1, 'a', true, null] });
      expect(result.arr).toEqual([1, 'a', true, null]);
    });

    it('nested arrays', () => {
      const result = serializeFormValues({ matrix: [[1, 2], [3, 4]] });
      expect(result.matrix).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('objekter', () => {
    it('fladt objekt bevares', () => {
      const result = serializeFormValues({ obj: { x: 1, y: 'a' } });
      expect(result.obj).toEqual({ x: 1, y: 'a' });
    });

    it('nested objekter rekursivt behandlet', () => {
      const result = serializeFormValues({ outer: { inner: { val: undefined } } });
      expect(result.outer).toEqual({ inner: { val: null } });
    });
  });

  describe('round-trip kompatibilitet', () => {
    it('resultatet er JSON-serialiserbart', () => {
      const values = {
        name: 'Test',
        amount: 100,
        date: '2024-01-01',
        optional: undefined,
        nested: { a: 1, b: undefined },
        list: [1, undefined, 3],
      };
      const serialized = serializeFormValues(values);
      expect(() => JSON.stringify(serialized)).not.toThrow();
      const json = JSON.stringify(serialized);
      const parsed = JSON.parse(json);
      expect(parsed.optional).toBeNull();
      expect(parsed.nested.b).toBeNull();
      expect(parsed.list[1]).toBeNull();
    });
  });

  describe('mange nøgler', () => {
    it('alle nøgler serialiseres', () => {
      const values = { a: 1, b: 2, c: undefined, d: 'hello' };
      const result = serializeFormValues(values);
      expect(Object.keys(result)).toEqual(['a', 'b', 'c', 'd']);
    });
  });
});

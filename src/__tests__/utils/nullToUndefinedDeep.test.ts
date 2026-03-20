import { nullToUndefinedDeep } from '../../utils/nullToUndefinedDeep';

describe('nullToUndefinedDeep', () => {
  describe('primitive værdier', () => {
    it('null → undefined', () => expect(nullToUndefinedDeep(null)).toBeUndefined());
    it('string → uændret', () => expect(nullToUndefinedDeep('hello')).toBe('hello'));
    it('number → uændret', () => expect(nullToUndefinedDeep(42)).toBe(42));
    it('boolean true → uændret', () => expect(nullToUndefinedDeep(true)).toBe(true));
    it('boolean false → uændret', () => expect(nullToUndefinedDeep(false)).toBe(false));
    it('0 → uændret', () => expect(nullToUndefinedDeep(0)).toBe(0));
    it('tom streng → uændret', () => expect(nullToUndefinedDeep('')).toBe(''));
  });

  describe('undefined', () => {
    it('undefined → undefined', () => expect(nullToUndefinedDeep(undefined)).toBeUndefined());
  });

  describe('fladt objekt', () => {
    it('null-felter i objekt → undefined', () => {
      const result = nullToUndefinedDeep({ a: null, b: 'hello', c: 42 });
      expect(result).toEqual({ a: undefined, b: 'hello', c: 42 });
    });

    it('tomt objekt → tomt objekt', () => {
      expect(nullToUndefinedDeep({})).toEqual({});
    });

    it('alle null-felter → alle undefined', () => {
      const result = nullToUndefinedDeep({ x: null, y: null });
      expect(result).toEqual({ x: undefined, y: undefined });
    });
  });

  describe('nested objekter', () => {
    it('null i nested objekt → undefined', () => {
      const result = nullToUndefinedDeep({ a: { b: null, c: 'value' } });
      expect(result).toEqual({ a: { b: undefined, c: 'value' } });
    });

    it('dybt nested null → undefined', () => {
      const result = nullToUndefinedDeep({ a: { b: { c: { d: null } } } });
      expect(result).toEqual({ a: { b: { c: { d: undefined } } } });
    });

    it('nested objekt med mixed typer', () => {
      const result = nullToUndefinedDeep({
        name: 'test',
        nested: { value: null, count: 3, flag: true },
      });
      expect(result).toEqual({
        name: 'test',
        nested: { value: undefined, count: 3, flag: true },
      });
    });
  });

  describe('arrays', () => {
    it('array med null → array med undefined', () => {
      const result = nullToUndefinedDeep([null, 'hello', null]);
      expect(result).toEqual([undefined, 'hello', undefined]);
    });

    it('tom array → tom array', () => {
      expect(nullToUndefinedDeep([])).toEqual([]);
    });

    it('array af objekter med null → array af objekter med undefined', () => {
      const result = nullToUndefinedDeep([{ a: null }, { a: 'hello' }]);
      expect(result).toEqual([{ a: undefined }, { a: 'hello' }]);
    });

    it('nested arrays', () => {
      const result = nullToUndefinedDeep([[null, 1], [2, null]]);
      expect(result).toEqual([[undefined, 1], [2, undefined]]);
    });
  });

  describe('realistisk JSON round-trip case', () => {
    it('JSON parse → nullToUndefinedDeep → alle null fjernet', () => {
      const json = JSON.parse('{"a":null,"b":"ok","c":{"d":null,"e":1},"f":[null,2]}');
      const result = nullToUndefinedDeep(json);
      expect(result).toEqual({ a: undefined, b: 'ok', c: { d: undefined, e: 1 }, f: [undefined, 2] });
    });
  });
});

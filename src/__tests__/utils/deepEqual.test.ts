import { deepEqual } from '../../utils/deepEqual';

describe('deepEqual', () => {
  it('ignorerer property-rækkefølge, men bevarer array-rækkefølge', () => {
    expect(deepEqual({ first: 1, second: { value: 2 } }, { second: { value: 2 }, first: 1 })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('skelner manglende properties fra eksplicit undefined', () => {
    expect(deepEqual({}, { value: undefined })).toBe(false);
  });

  it('håndterer identitet, primitive værdier og null fail-closed', () => {
    const shared = { value: 1 };
    expect(deepEqual(shared, shared)).toBe(true);
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });

  it('afviser array- og objekttypekombinationer samt ulige arraylængder', () => {
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
  });

  it('sammenligner nested arrays og afviser objekter med forskellig struktur', () => {
    expect(deepEqual([[1], { value: 2 }], [[1], { value: 2 }])).toBe(true);
    expect(deepEqual({ first: 1 }, { second: 1 })).toBe(false);
    expect(deepEqual({ first: { value: 1 } }, { first: { value: 2 } })).toBe(false);
  });
});

import { deepEqual } from '../../utils/deepEqual';

describe('deepEqual', () => {
  it('ignorerer property-rækkefølge, men bevarer array-rækkefølge', () => {
    expect(deepEqual({ first: 1, second: { value: 2 } }, { second: { value: 2 }, first: 1 })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('skelner manglende properties fra eksplicit undefined', () => {
    expect(deepEqual({}, { value: undefined })).toBe(false);
  });
});

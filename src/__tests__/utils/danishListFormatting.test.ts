import { formatDanishList } from '../../utils/danishListFormatting';

describe('formatDanishList', () => {
  it.each([
    [[], ''],
    [['A'], 'A'],
    [['A', 'B'], 'A og B'],
    [['A', 'B', 'C'], 'A, B og C'],
  ])('formaterer %j som dansk liste', (items, expected) => {
    expect(formatDanishList(items)).toBe(expected);
  });
});

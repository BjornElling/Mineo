import { formatZodIssues } from '../../utils/zodIssueFormatting';

describe('formatZodIssues', () => {
  it('formaterer enkelt issue med dotted path', () => {
    const result = formatZodIssues([{ path: ['row', 0, 'amount'], message: 'Invalid value' }], 10);
    expect(result).toBe('row.0.amount: Invalid value');
  });

  it('tom path → (root)', () => {
    const result = formatZodIssues([{ path: [], message: 'Required' }], 10);
    expect(result).toBe('(root): Required');
  });

  it('flere issues adskilles med newline', () => {
    const result = formatZodIssues(
      [
        { path: ['a'], message: 'msg a' },
        { path: ['b', 1], message: 'msg b' },
      ],
      10
    );
    expect(result).toBe('a: msg a\nb.1: msg b');
  });

  it('trunkerer til max antal', () => {
    const issues = [
      { path: ['a'], message: '1' },
      { path: ['b'], message: '2' },
      { path: ['c'], message: '3' },
    ];
    const result = formatZodIssues(issues, 2);
    expect(result).toBe('a: 1\nb: 2');
  });

  it('symbol-segment bruger description', () => {
    const sym = Symbol('mySymbol');
    const result = formatZodIssues([{ path: [sym, 'x'], message: 'm' }], 10);
    expect(result).toBe('mySymbol.x: m');
  });

  it('symbol uden description → "symbol"', () => {
    const sym = Symbol();
    const result = formatZodIssues([{ path: [sym], message: 'm' }], 10);
    expect(result).toBe('symbol: m');
  });

  it('tom issue-liste → tom streng', () => {
    expect(formatZodIssues([], 10)).toBe('');
  });
});

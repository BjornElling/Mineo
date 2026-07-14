import { cloneAndDeepFreeze, deepFreeze } from '../../utils/deepFreeze';

describe('deepFreeze', () => {
  it('fryser nested objekter og arrays rekursivt', () => {
    const value = deepFreeze({ nested: { rows: [{ value: 1 }] } });

    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.nested)).toBe(true);
    expect(Object.isFrozen(value.nested.rows)).toBe(true);
    expect(Object.isFrozen(value.nested.rows[0])).toBe(true);
  });

  it('kloner før frysning, så callerens objekt ikke overtages', () => {
    const source = { nested: { value: 1 } };
    const snapshot = cloneAndDeepFreeze(source);

    source.nested.value = 2;

    expect(snapshot.nested.value).toBe(1);
    expect(Object.isFrozen(source)).toBe(false);
  });
});

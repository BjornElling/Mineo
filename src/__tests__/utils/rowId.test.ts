import { describe, expect, it } from 'vitest';
import { createRowId } from '../../utils/rowId';

describe('createRowId', () => {
  it('returnerer en streng', () => {
    expect(typeof createRowId('test')).toBe('string');
  });

  it('starter med prefix_', () => {
    expect(createRowId('myPrefix').startsWith('myPrefix_')).toBe(true);
  });

  it('to kald giver unikke IDs', () => {
    const id1 = createRowId('row');
    const id2 = createRowId('row');
    expect(id1).not.toBe(id2);
  });

  it('prefix er inkluderet i resultatet', () => {
    const id = createRowId('taf');
    expect(id).toContain('taf');
  });

  it('tom prefix giver id der starter med _', () => {
    const id = createRowId('');
    expect(id.startsWith('_')).toBe(true);
  });

  it('prefix med specielle tegn bevares', () => {
    const id = createRowId('svie-smerte');
    expect(id.startsWith('svie-smerte_')).toBe(true);
  });

  it('100 kald giver 100 unikke IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createRowId('r')));
    expect(ids.size).toBe(100);
  });
});

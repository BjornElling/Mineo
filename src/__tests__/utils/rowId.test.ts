import { createEmptyRowId, createRowId } from '../../utils/rowId';

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

describe('createEmptyRowId', () => {
  it('er deterministisk: samme prefix+seed giver samme id (kritisk for StrictMode-sikkerhed)', () => {
    expect(createEmptyRowId('row', 3)).toBe(createEmptyRowId('row', 3));
  });

  it('forskellige seeds giver forskellige id', () => {
    expect(createEmptyRowId('row', 0)).not.toBe(createEmptyRowId('row', 1));
  });

  it('kan ikke kollidere med et persisteret random id (createRowId)', () => {
    // createRowId('row') => 'row_<uuid>'; createEmptyRowId('row', n) => 'row_empty_<n>'.
    const emptyId = createEmptyRowId('row', 0);
    expect(emptyId).toBe('row_empty_0');
    // Et random id indeholder aldrig '_empty_'-segmentet.
    expect(createRowId('row')).not.toContain('_empty_');
  });
});

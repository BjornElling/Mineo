import {
  isDateDraftSeparatorChar,
  normalizeDateDraftSeparators,
  normalizeDateDraftOnCommit,
  isDateLikeDraftAllowed,
} from '../../utils/dateDraftNormalization';

// ─── isDateDraftSeparatorChar ──────────────────────────────────────────────

describe('isDateDraftSeparatorChar', () => {
  it('tom streng → false', () => {
    expect(isDateDraftSeparatorChar('')).toBe(false);
  });

  it('ciffer → false (ikke separator)', () => {
    expect(isDateDraftSeparatorChar('5')).toBe(false);
  });

  it('bogstav → false (alfanumerisk)', () => {
    expect(isDateDraftSeparatorChar('a')).toBe(false);
    expect(isDateDraftSeparatorChar('æ')).toBe(false);
  });

  it('bindestreg, punktum, skråstreg, mellemrum → true', () => {
    expect(isDateDraftSeparatorChar('-')).toBe(true);
    expect(isDateDraftSeparatorChar('.')).toBe(true);
    expect(isDateDraftSeparatorChar('/')).toBe(true);
    expect(isDateDraftSeparatorChar(' ')).toBe(true);
  });
});

// ─── normalizeDateDraftSeparators ──────────────────────────────────────────

describe('normalizeDateDraftSeparators', () => {
  it('punktum-separatorer → bindestreg', () => {
    expect(normalizeDateDraftSeparators('15.06.2024')).toBe('15-06-2024');
  });

  it('skråstreg-separatorer → bindestreg', () => {
    expect(normalizeDateDraftSeparators('15/06/2024')).toBe('15-06-2024');
  });

  it('blandede og gentagne separatorer kollapses til én bindestreg', () => {
    expect(normalizeDateDraftSeparators('15 . / 06--2024')).toBe('15-06-2024');
  });

  it('trimmer whitespace i kanterne', () => {
    expect(normalizeDateDraftSeparators('  15-06-2024  ')).toBe('15-06-2024');
  });

  it('rene cifre forbliver uændret', () => {
    expect(normalizeDateDraftSeparators('15062024')).toBe('15062024');
  });
});

// ─── normalizeDateDraftOnCommit ────────────────────────────────────────────

describe('normalizeDateDraftOnCommit', () => {
  it('trimmer kun whitespace', () => {
    expect(normalizeDateDraftOnCommit('  15-06-2024  ')).toBe('15-06-2024');
  });

  it('ændrer ikke interne separatorer', () => {
    expect(normalizeDateDraftOnCommit('15.06.2024')).toBe('15.06.2024');
  });
});

// ─── isDateLikeDraftAllowed ────────────────────────────────────────────────

describe('isDateLikeDraftAllowed', () => {
  const segments = [2, 2, 4] as const;

  it('komplet dd-mm-yyyy → tilladt', () => {
    expect(isDateLikeDraftAllowed('15-06-2024', segments)).toBe(true);
  });

  it('delvis indtastning → tilladt', () => {
    expect(isDateLikeDraftAllowed('1', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('15-', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('15-06', segments)).toBe(true);
  });

  it('3-cifret dag → ikke tilladt (segment for langt)', () => {
    expect(isDateLikeDraftAllowed('155', segments)).toBe(false);
  });

  it('3-cifret måned → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-066', segments)).toBe(false);
  });

  it('5-cifret år → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-06-20245', segments)).toBe(false);
  });

  it('for mange segmenter → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-06-2024-1', segments)).toBe(false);
  });

  it('bogstaver → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-ab-2024', segments)).toBe(false);
  });

  it('tom streng → tilladt', () => {
    expect(isDateLikeDraftAllowed('', segments)).toBe(true);
  });
});

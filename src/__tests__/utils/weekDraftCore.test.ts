import { parseWeekDraftForCommit } from '../../utils/weekDraftCore';

const config = {
  minYear: 2000,
  maxYear: 2030,
  twoDigitYearPolicy: 'infer' as const,
  maxDraftLength: 8,
};

describe('parseWeekDraftForCommit', () => {
  it('tom → undefined', () => {
    expect(parseWeekDraftForCommit('  ', config)).toEqual({ ok: true, value: undefined });
  });

  it('kanoniserer uge/år til UU/ÅÅÅÅ', () => {
    expect(parseWeekDraftForCommit('5/2020', config)).toEqual({ ok: true, value: '05/2020' });
  });

  it('accepterer alternative separatorer', () => {
    expect(parseWeekDraftForCommit('5-2020', config)).toEqual({ ok: true, value: '05/2020' });
  });

  it('uge < 1 → "Ugyldig uge" (ikke partial-eligible)', () => {
    expect(parseWeekDraftForCommit('0/2020', config)).toEqual({
      ok: false,
      errorMessage: 'Ugyldig uge',
      partialEligible: false,
    });
  });

  it('uge over årets maksimum → "Uge skal være mellem 1 og N"', () => {
    // 2021 har 52 uger.
    expect(parseWeekDraftForCommit('53/2021', config)).toEqual({
      ok: false,
      errorMessage: 'Uge skal være mellem 1 og 52',
      partialEligible: false,
    });
  });

  it('år uden for interval bruger den fælles årstals-besked', () => {
    expect(parseWeekDraftForCommit('10/1990', config)).toEqual({
      ok: false,
      errorMessage: 'Årstallet skal være mellem 2000 og 2030',
      partialEligible: false,
    });
  });

  it('ufuldstændigt format er partial-eligible', () => {
    expect(parseWeekDraftForCommit('05', config)).toEqual({
      ok: false,
      errorMessage: 'Ugyldigt format',
      partialEligible: true,
    });
  });

  it('respekterer maxDraftLength', () => {
    expect(parseWeekDraftForCommit('123456789', config)).toEqual({
      ok: false,
      errorMessage: 'Ugyldigt format',
      partialEligible: true,
    });
  });
});

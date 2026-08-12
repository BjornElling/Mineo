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

  // `invalidKind` er den maskinlæsbare halvdel: den afgør, om codec'en giver feltet en KONKRET tooltip
  // eller den generiske «Fejl i indtastning». Den måles derfor sammen med beskeden, ikke i stedet for.
  it('uge < 1 → konkret nedre grænse, markeret som ugenummer-fejl', () => {
    expect(parseWeekDraftForCommit('0/2020', config)).toEqual({
      ok: false,
      invalidKind: 'weekNumber',
      errorMessage: 'Uge skal være mindst 1',
    });
  });

  it('uge over årets maksimum → "Uge skal være mellem 1 og N"', () => {
    // 2021 har 52 uger.
    expect(parseWeekDraftForCommit('53/2021', config)).toEqual({
      ok: false,
      invalidKind: 'weekNumber',
      errorMessage: 'Uge skal være mellem 1 og 52',
    });
  });

  it('år uden for interval bruger den fælles årstals-besked', () => {
    expect(parseWeekDraftForCommit('10/1990', config)).toEqual({
      ok: false,
      invalidKind: 'malformed',
      errorMessage: 'Årstallet skal være mellem 2000 og 2030',
    });
  });

  it('ufuldstændigt format → "Ugyldigt format"', () => {
    expect(parseWeekDraftForCommit('05', config)).toEqual({
      ok: false,
      invalidKind: 'malformed',
      errorMessage: 'Ugyldigt format',
    });
  });

  it('respekterer maxDraftLength', () => {
    expect(parseWeekDraftForCommit('123456789', config)).toEqual({
      ok: false,
      invalidKind: 'malformed',
      errorMessage: 'Ugyldigt format',
    });
  });
});

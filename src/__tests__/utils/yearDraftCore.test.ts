import {
  getYearRangeErrorMessage,
  parseYearDraftForCommit,
  resolveYearFromToken,
} from '../../utils/yearDraftCore';

describe('getYearRangeErrorMessage', () => {
  it('tom streng når inden for interval', () => {
    expect(getYearRangeErrorMessage(2020, 2000, 2030)).toBe('');
  });

  it('viser det ene tilladte år når min === max', () => {
    expect(getYearRangeErrorMessage(2019, 2020, 2020)).toBe('Årstallet skal være 2020');
    expect(getYearRangeErrorMessage(2021, 2020, 2020)).toBe('Årstallet skal være 2020');
  });

  it('viser interval når min < max', () => {
    expect(getYearRangeErrorMessage(1990, 2000, 2030)).toBe('Årstallet skal være mellem 2000 og 2030');
    expect(getYearRangeErrorMessage(2050, 2000, 2030)).toBe('Årstallet skal være mellem 2000 og 2030');
  });

  it('viser kun nedre/øvre grænse når kun én er sat', () => {
    expect(getYearRangeErrorMessage(1990, 2000, undefined)).toBe('Årstallet skal være 2000 eller senere');
    expect(getYearRangeErrorMessage(2050, undefined, 2030)).toBe('Årstallet skal være 2030 eller tidligere');
  });
});

describe('resolveYearFromToken', () => {
  it('4-cifret år parses direkte', () => {
    expect(resolveYearFromToken('2020', 'infer')).toBe(2020);
  });

  it('2-cifret med assume20xx → 20xx', () => {
    expect(resolveYearFromToken('20', 'assume20xx')).toBe(2020);
  });

  it('2-cifret med reject → null', () => {
    expect(resolveYearFromToken('20', 'reject')).toBeNull();
  });

  it('3-cifret og andre længder → null', () => {
    expect(resolveYearFromToken('202', 'infer')).toBeNull();
    expect(resolveYearFromToken('20200', 'infer')).toBeNull();
  });
});

describe('parseYearDraftForCommit', () => {
  const config = { minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' as const };

  it('tom → undefined', () => {
    expect(parseYearDraftForCommit('  ', config)).toEqual({ ok: true, value: undefined });
  });

  it('bogstaver → "Ugyldigt årstal"', () => {
    expect(parseYearDraftForCommit('20x0', config)).toEqual({ ok: false, errorMessage: 'Ugyldigt årstal' });
  });

  it('gyldigt år inden for interval', () => {
    expect(parseYearDraftForCommit('2020', config)).toEqual({ ok: true, value: 2020 });
  });

  it('år uden for interval → interval-besked', () => {
    expect(parseYearDraftForCommit('1990', config)).toEqual({
      ok: false,
      errorMessage: 'Årstallet skal være mellem 2000 og 2030',
    });
  });
});

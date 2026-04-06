import {
  getStandardLoenTableHeaders,
  getStandardLoenHeaderIndex,
  resolveStandardLoenColumnLabel,
  STANDARD_LOEN_FPFVSHSO_LABEL,
  STANDARD_LOEN_PENSION_LABEL,
  STANDARD_LOEN_SAMLET_LABEL,
} from '../../../domain/aarsloen/standardLoenTableColumns';

describe('standardLoenTableColumns', () => {
  it('bruger Løn og Løn (2) som de to standard lønkolonner', () => {
    expect(getStandardLoenTableHeaders('maaned')).toEqual([
      'Måned',
      'År',
      'Løn',
      'Løn (2)',
      'Ikke-pensions-\ngivende løn',
      'ATP og anden\nløn u. tillæg',
      'FP/FV/SH/\nSO/St.B.',
      'Arb.g.\nPension',
      'Samlet løn',
    ]);
  });

  it('giver de nye labels for col2 og col3 i fejl- og debugkontekster', () => {
    expect(resolveStandardLoenColumnLabel('col2')).toBe('Løn');
    expect(resolveStandardLoenColumnLabel('col3')).toBe('Løn (2)');
  });

  it.each(['maaned', 'uge', 'dag'] as const)(
    'getStandardLoenHeaderIndex finder korrekte labels for loenperiode=%s',
    (loenperiode) => {
      const headers = getStandardLoenTableHeaders(loenperiode);
      expect(headers[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_FPFVSHSO_LABEL)]).toBe(STANDARD_LOEN_FPFVSHSO_LABEL);
      expect(headers[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_PENSION_LABEL)]).toBe(STANDARD_LOEN_PENSION_LABEL);
      expect(headers[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_SAMLET_LABEL)]).toBe(STANDARD_LOEN_SAMLET_LABEL);
    }
  );

  it('getStandardLoenHeaderIndex fejler hårdt hvis labelen ikke findes', () => {
    expect(() => getStandardLoenHeaderIndex('maaned', 'Ikke-eksisterende kolonne')).toThrow('CRITICAL');
  });
});

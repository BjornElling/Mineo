import {
  getStandardLoenTableHeaders,
  resolveStandardLoenColumnLabel,
} from '../../../domain/aarsloen/standardLoenTableColumns';

describe('standardLoenTableColumns', () => {
  it('bruger Løn og Løn (2) som de to standard lønkolonner', () => {
    expect(getStandardLoenTableHeaders('maaned')).toEqual([
      'Måned',
      'År',
      'Løn',
      'Løn (2)',
      'Ikke-pensions-\ngivende løn',
      'ATP og anden\nikke FB-løn',
      'Ferieberet.\nløn',
      'FP/FV/SH/\nSO/St.B.',
      'Arb.g.\nPension',
      'Samlet løn',
    ]);
  });

  it('giver de nye labels for col2 og col3 i fejl- og debugkontekster', () => {
    expect(resolveStandardLoenColumnLabel('col2')).toBe('Løn');
    expect(resolveStandardLoenColumnLabel('col3')).toBe('Løn (2)');
  });
});

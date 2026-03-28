import {
  OFFENTLIGE_YDELSER_PDF_HEADERS,
  OFFENTLIGE_YDELSER_TABLE_HEADERS,
  resolveOffentligeYdelserColumnLabel,
} from '../../../domain/erstatningsopgoerelse/offentligeYdelserTableColumns';

describe('offentligeYdelserTableColumns', () => {
  it('bruger Ydelse og Ydelse (2) som de to standard ydelseskolonner', () => {
    expect(OFFENTLIGE_YDELSER_TABLE_HEADERS).toEqual([
      'Fra-dato',
      'Til-dato',
      'Ydelse',
      'Ydelse (2)',
      'Ydelsestype',
      'Periodisering',
      'Antal dage',
      'Ydelse / dag',
    ]);
    expect(OFFENTLIGE_YDELSER_PDF_HEADERS).toEqual([
      'Fra-dato',
      'Til-dato',
      'Ydelse',
      'Ydelse (2)',
      'I alt',
    ]);
  });

  it('giver de nye labels for ydelse og det andet ydelsesfelt i fejl- og debugkontekster', () => {
    expect(resolveOffentligeYdelserColumnLabel('ydelse')).toBe('Ydelse');
    expect(resolveOffentligeYdelserColumnLabel('tillaeg')).toBe('Ydelse (2)');
  });
});

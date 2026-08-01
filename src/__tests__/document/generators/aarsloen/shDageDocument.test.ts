import { buildSHDagePeriodDescription } from '../../../../document/generators/aarsloen/shDageDocument';

const utcDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe('buildSHDagePeriodDescription', () => {
  it('sammenlægger sammenhængende perioder og bruger entalsoverskrift', () => {
    expect(buildSHDagePeriodDescription([
      { start: utcDate('2024-01-01'), end: utcDate('2024-01-15') },
      { start: utcDate('2024-01-16'), end: utcDate('2024-01-31') },
    ])).toBe('Periode: 1. januar 2024 - 31. januar 2024');
  });

  it('bruger flertalsoverskrift og dansk liste ved adskilte perioder', () => {
    expect(buildSHDagePeriodDescription([
      { start: utcDate('2024-01-01'), end: utcDate('2024-01-02') },
      { start: utcDate('2024-02-01'), end: utcDate('2024-02-02') },
      { start: utcDate('2024-03-01'), end: utcDate('2024-03-02') },
    ])).toBe(
      'Perioder: 1. januar 2024 - 2. januar 2024, 1. februar 2024 - 2. februar 2024 og 1. marts 2024 - 2. marts 2024'
    );
  });
});

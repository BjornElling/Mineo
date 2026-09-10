import {
  CSV_DELIMITER,
  escapeCsvCell,
  normalizeCsvHeader,
  toCsvScalar,
} from '../../../domain/eoInspektion/csvUtils';

describe('CSV-hjælpere', () => {
  it('normaliserer flerlinjede overskrifter uden at ændre deres indhold', () => {
    expect(normalizeCsvHeader('  Første\n   anden\r\n tredje  ')).toBe('Første anden tredje');
  });

  it('escaper kun celler, som CSV-formatet kræver', () => {
    expect(CSV_DELIMITER).toBe(';');
    expect(escapeCsvCell('Almindelig tekst')).toBe('Almindelig tekst');
    expect(escapeCsvCell('A;B')).toBe('"A;B"');
    expect(escapeCsvCell('"citat"')).toBe('"""citat"""');
    expect(escapeCsvCell('første\r\nanden')).toBe('"første\r\nanden"');
  });

  it('serialiserer alle understøttede skalarer deterministisk', () => {
    expect(toCsvScalar(null)).toBe('');
    expect(toCsvScalar(undefined)).toBe('');
    expect(toCsvScalar('tekst')).toBe('tekst');
    expect(toCsvScalar(12.5)).toBe('12.5');
    expect(toCsvScalar(true)).toBe('Ja');
    expect(toCsvScalar(false)).toBe('Nej');
  });

  it('afviser ikke-skalarer i udvikling, før sagsdata kan blive til en uklar CSV-celle', () => {
    expect(() => toCsvScalar({ journalnr: 'J-1' })).toThrow('CSV cell must be scalar, got: object');
  });

  it('giver en GDPR-sikker fallback i produktion uden at skrive værdien til console', () => {
    vi.stubEnv('DEV', false);
    try {
      expect(toCsvScalar({ journalnr: 'J-1' })).toBe('[Ugyldig CSV-værdi]');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

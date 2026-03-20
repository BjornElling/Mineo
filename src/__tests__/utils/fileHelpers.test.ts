import { sanitizeFilename, generateFilename } from '../../utils/fileHelpers';

// ─── sanitizeFilename ──────────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('returnerer fallback for null', () => {
    expect(sanitizeFilename(null)).toBe('Erstatningsopgørelse');
  });

  it('returnerer fallback for undefined', () => {
    expect(sanitizeFilename(undefined)).toBe('Erstatningsopgørelse');
  });

  it('returnerer fallback for tom streng', () => {
    expect(sanitizeFilename('')).toBe('Erstatningsopgørelse');
  });

  it('returnerer custom fallback', () => {
    expect(sanitizeFilename(null, 'MinFallback')).toBe('MinFallback');
  });

  it('bevarer danske bogstaver', () => {
    const result = sanitizeFilename('ÆØÅæøå');
    expect(result).toBe('ÆØÅæøå');
  });

  it('fjerner ugyldige tegn', () => {
    expect(sanitizeFilename('fil<>:"/\\|?*navn')).toBe('filnavn');
  });

  it('reducerer multiple mellemrum til ét', () => {
    expect(sanitizeFilename('a  b   c')).toBe('a b c');
  });

  it('fjerner trailing punktummer', () => {
    expect(sanitizeFilename('navn...')).toBe('navn');
  });

  it('fjerner leading og trailing whitespace', () => {
    expect(sanitizeFilename('  navn  ')).toBe('navn');
  });

  it('bevarer bindestreger og underscores', () => {
    expect(sanitizeFilename('min-fil_navn')).toBe('min-fil_navn');
  });

  it('tilføjer underscore til Windows-reserverede navne', () => {
    expect(sanitizeFilename('con')).toBe('con_');
    expect(sanitizeFilename('NUL')).toBe('NUL_');
    expect(sanitizeFilename('COM1')).toBe('COM1_');
    expect(sanitizeFilename('lpt9')).toBe('lpt9_');
  });

  it('afkorter til 150 tegn', () => {
    const lang = 'a'.repeat(200);
    const result = sanitizeFilename(lang);
    expect(result.length).toBeLessThanOrEqual(150);
  });

  it('returnerer fallback når alle tegn er ugyldige', () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBe('Erstatningsopgørelse');
  });

  it('bevarer punktummer i midten', () => {
    expect(sanitizeFilename('fil.navn')).toBe('fil.navn');
  });
});

// ─── generateFilename ──────────────────────────────────────────────────────────

describe('generateFilename', () => {
  it('returnerer kun prefix ved null-input (ingen ekstra felter)', () => {
    // parts starter altid med EO_FILENAME_PREFIX, så null → kun 'MINEO'
    expect(generateFilename(null)).toBe('MINEO');
  });

  it('returnerer kun prefix ved undefined-input', () => {
    expect(generateFilename(undefined)).toBe('MINEO');
  });

  it('returnerer kun prefix ved tomt stamdata', () => {
    expect(generateFilename({})).toBe('MINEO');
  });

  it('returnerer kun prefix når kun journalnr er udfyldt (journalnr-branch er ikke nået via normal sti)', () => {
    // journalnr-fallback-logikken er placeret i en branch der kræver parts.length===0,
    // men parts starter med EO_FILENAME_PREFIX, så den branch er utilgængelig.
    const result = generateFilename({ stamdata: { journalnr: 'J-42' } });
    expect(result).toBe('MINEO');
  });

  it('inkluderer skadelidte i filnavn', () => {
    const result = generateFilename({ stamdata: { skadelidte: 'Anders Jensen' } });
    expect(result).toContain('Anders Jensen');
    expect(result.startsWith('MINEO')).toBe(true);
  });

  it('inkluderer skadestype i filnavn', () => {
    const result = generateFilename({
      stamdata: { skadelidte: 'Anders Jensen', skadestype: 'Arbejdsulykke' },
    });
    expect(result).toContain('Arbejdsulykke');
  });

  it('filtrerer placeholder-skadestype "Vælg skadestype" fra', () => {
    const result = generateFilename({
      stamdata: { skadelidte: 'Person', skadestype: 'Vælg skadestype' },
    });
    expect(result).not.toContain('Vælg skadestype');
  });

  it('inkluderer dato i dansk format', () => {
    const result = generateFilename({
      stamdata: { skadelidte: 'Person', skadesdato: '2024-06-15' },
    });
    expect(result).toContain('15-06-2024');
  });

  it('bygger fuld filnavns-streng med alle felter', () => {
    const result = generateFilename({
      stamdata: {
        skadelidte: 'Lars Nielsen',
        skadestype: 'Erhvervssygdom',
        skadesdato: '2023-03-01',
      },
    });
    expect(result).toBe('MINEO - Lars Nielsen - Erhvervssygdom - 01-03-2023');
  });

  it('starter altid med MINEO', () => {
    expect(generateFilename({ stamdata: { journalnr: 'X' } }).startsWith('MINEO')).toBe(true);
    expect(generateFilename({ stamdata: { skadelidte: 'Y' } }).startsWith('MINEO')).toBe(true);
    expect(generateFilename(null).startsWith('MINEO')).toBe(true);
  });
});

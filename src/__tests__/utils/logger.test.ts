/// <reference types="vitest/globals" />
import { sanitizeFilenameForLog } from '../../utils/logger';

describe('sanitizeFilenameForLog', () => {
  it('removes personal data while keeping technical details', () => {
    const input = 'Testi Testesen - Arbejdsulykke - 2024-01-26.eo';
    const output = sanitizeFilenameForLog(input);

    expect(output).toContain('.eo');
    expect(output.toLowerCase()).toContain('hash');
    expect(output).not.toContain('Testi');
    expect(output).not.toContain('Testesen');
  });

  it('returnerer fallback for ikke-streng input', () => {
    expect(sanitizeFilenameForLog(null)).toBe('ukendt fil (navn-hash ukendt)');
    expect(sanitizeFilenameForLog(undefined)).toBe('ukendt fil (navn-hash ukendt)');
    expect(sanitizeFilenameForLog(42)).toBe('ukendt fil (navn-hash ukendt)');
  });

  it('returnerer fallback for tom streng', () => {
    expect(sanitizeFilenameForLog('')).toBe('ukendt fil (navn-hash ukendt)');
    expect(sanitizeFilenameForLog('   ')).toBe('ukendt fil (navn-hash ukendt)');
  });

  it('håndterer fil uden filendelse', () => {
    const output = sanitizeFilenameForLog('filnavnudenendelse');
    expect(output).toMatch(/^fil \(navn-hash [0-9a-f]+\)$/);
  });

  it('er deterministisk (samme input → samme output)', () => {
    const filename = 'test.eo';
    expect(sanitizeFilenameForLog(filename)).toBe(sanitizeFilenameForLog(filename));
  });
});

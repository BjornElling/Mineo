/**
 * Tests for eoInspektionFormat.ts
 * Ren formattering-utilities til EOInspektion display-værdier.
 */

import {
  formatIsoValue,
  formatDanishValue,
  formatAmountDisplay,
  formatPercent,
  formatBoolean,
  formatInteger,
  formatDecimal,
  formatTextValue,
  formatDays,
} from '../../../domain/eoInspektion/eoInspektionFormat';
import type { ISODateString, DanishDateString } from '../../../types/branded';

const iso = (s: string) => s as ISODateString;
const danish = (s: string) => s as DanishDateString;

describe('formatIsoValue', () => {
  it('konverterer ISO-dato til dansk format', () => {
    expect(formatIsoValue(iso('2024-03-04'))).toBe('04-03-2024');
  });

  it('returnerer "-" ved null', () => {
    expect(formatIsoValue(null)).toBe('-');
  });
});

describe('formatDanishValue', () => {
  it('returnerer dansk dato uændret', () => {
    expect(formatDanishValue(danish('04-03-2024'))).toBe('04-03-2024');
  });

  it('returnerer "-" ved null', () => {
    expect(formatDanishValue(null)).toBe('-');
  });
});

describe('formatAmountDisplay', () => {
  it('returnerer "-" ved null', () => {
    expect(formatAmountDisplay(null)).toBe('-');
  });

  it('returnerer "-" ved undefined', () => {
    expect(formatAmountDisplay(undefined)).toBe('-');
  });

  it('formaterer positivt beløb med 2 decimaler', () => {
    // 1234.56 → dansk format "1.234,56"
    const result = formatAmountDisplay(1234.56);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toMatch(/\d/);
  });

  it('formaterer nul', () => {
    const result = formatAmountDisplay(0);
    expect(result).not.toBe('-');
  });
});

describe('formatPercent', () => {
  it('returnerer "-" ved null', () => {
    expect(formatPercent(null)).toBe('-');
  });

  it('returnerer "-" ved undefined', () => {
    expect(formatPercent(undefined)).toBe('-');
  });

  it('formaterer decimal som procent (0.05 → "5,00%")', () => {
    const result = formatPercent(0.05);
    expect(result).toContain('5');
    expect(result).toContain('%');
  });

  it('respekterer decimals-parameter', () => {
    const result = formatPercent(0.1, 0);
    expect(result).toContain('%');
    expect(result).not.toContain(',');
  });
});

describe('formatBoolean', () => {
  it('returnerer "Ja" for true (default labels)', () => {
    expect(formatBoolean(true)).toBe('Ja');
  });

  it('returnerer "Nej" for false (default labels)', () => {
    expect(formatBoolean(false)).toBe('Nej');
  });

  it('bruger custom labels', () => {
    expect(formatBoolean(true, ['Yes', 'No'])).toBe('Yes');
    expect(formatBoolean(false, ['Yes', 'No'])).toBe('No');
  });
});

describe('formatInteger', () => {
  it('returnerer "-" ved null', () => {
    expect(formatInteger(null)).toBe('-');
  });

  it('returnerer "-" ved undefined', () => {
    expect(formatInteger(undefined)).toBe('-');
  });

  it('formaterer heltal uden decimaler', () => {
    const result = formatInteger(1000);
    expect(result).not.toContain(',');
    expect(result).toContain('1');
    expect(result).toContain('000');
  });
});

describe('formatDecimal', () => {
  it('returnerer "-" ved null', () => {
    expect(formatDecimal(null)).toBe('-');
  });

  it('returnerer "-" ved undefined', () => {
    expect(formatDecimal(undefined)).toBe('-');
  });

  it('formaterer med 2 decimaler som default', () => {
    const result = formatDecimal(1.5);
    expect(result).toContain('1');
    expect(result).toMatch(/\d/);
  });

  it('respekterer decimals-parameter', () => {
    const result = formatDecimal(1.0, 0);
    expect(result).not.toContain(',');
  });
});

describe('formatTextValue', () => {
  it('returnerer "-" ved null', () => {
    expect(formatTextValue(null)).toBe('-');
  });

  it('returnerer "-" ved undefined', () => {
    expect(formatTextValue(undefined)).toBe('-');
  });

  it('returnerer "-" ved tom streng', () => {
    expect(formatTextValue('')).toBe('-');
  });

  it('returnerer "-" ved whitespace-only', () => {
    expect(formatTextValue('   ')).toBe('-');
  });

  it('returnerer teksten uændret', () => {
    expect(formatTextValue('Hej verden')).toBe('Hej verden');
  });
});

describe('formatDays', () => {
  it('returnerer "-" ved null', () => {
    expect(formatDays(null)).toBe('-');
  });

  it('returnerer "-" ved undefined', () => {
    expect(formatDays(undefined)).toBe('-');
  });

  it('returnerer "1 dag" for 1', () => {
    expect(formatDays(1)).toBe('1 dag');
  });

  it('returnerer "5 dage" for 5', () => {
    const result = formatDays(5);
    expect(result).toContain('5');
    expect(result).toContain('dage');
  });

  it('returnerer "0 dage" for 0', () => {
    const result = formatDays(0);
    expect(result).toContain('0');
    expect(result).toContain('dage');
  });
});

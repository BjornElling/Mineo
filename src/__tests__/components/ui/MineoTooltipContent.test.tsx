import {
  splitTooltipTextIntoLines,
  TOOLTIP_FALLBACK_LINE_CHARACTER_LIMIT,
} from '../../../components/ui/MineoTooltipContent';

describe('MineoTooltipContent', () => {
  it('normaliserer manuelle linjeskift i korte tooltiptekster', () => {
    expect(splitTooltipTextIntoLines('  Første linje\n anden\tlinje  '))
      .toEqual(['Første linje anden linje']);
  });

  it('starter den anden linje med tekstens midterord', () => {
    const text = 'Juridisk omtvistet, men nyere retspraksis hælder mod fuld sats';
    const lines = splitTooltipTextIntoLines(text);

    expect(lines).toEqual([
      'Juridisk omtvistet, men nyere',
      'retspraksis hælder mod fuld sats',
    ]);
    expect(lines.join(' ')).toBe(text);
  });

  it('fordeler meget lange tekster på flere hele ord uden at miste indhold', () => {
    const text = [
      'Denne tooltiptekst er med vilje længere end den fælles grænse, så den fordeles på flere',
      'linjer uden manuelle linjeskift og uden at et ord deles mellem to linjer.',
    ].join(' ');
    const lines = splitTooltipTextIntoLines(text);

    expect(lines.length).toBeGreaterThan(2);
    expect(lines).toEqual(lines.map((line) => line.trim()));
    expect(lines.join(' ')).toBe(text);
    expect(TOOLTIP_FALLBACK_LINE_CHARACTER_LIMIT).toBe(50);
  });

  it('fordeler en bred EAL-fejl uden at efterlade et enkeltstående år eller ord', () => {
    const text = 'EAL-beregningen kan ikke gennemføres, fordi der mangler reguleringssats for 1999, 2000, 2001, 2002, 2003, 2004.';
    const wordWidths: Readonly<Record<string, number>> = {
      'EAL-beregningen': 100,
      kan: 21,
      ikke: 23,
      'gennemføres,': 79,
      fordi: 26,
      der: 19,
      mangler: 48,
      reguleringssats: 87,
      for: 16,
      '1999,': 27,
      '2000,': 31,
      '2001,': 28,
      '2002,': 30,
      '2003,': 30,
      '2004.': 31,
    };
    const measureText = (value: string): number => value
      .split(' ')
      .reduce((width, word, index) => width + (wordWidths[word] ?? 0) + (index > 0 ? 4 : 0), 0);
    const lines = splitTooltipTextIntoLines(text, { maxWidth: 320, measureText });

    expect(lines).toEqual([
      'EAL-beregningen kan ikke gennemføres,',
      'fordi der mangler reguleringssats for',
      '1999, 2000, 2001, 2002, 2003, 2004.',
    ]);
    expect(lines.every((line) => line.split(' ').length > 1)).toBe(true);
    expect(lines.join(' ')).toBe(text);
  });
});

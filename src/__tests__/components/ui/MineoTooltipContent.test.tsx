import { splitTooltipTextIntoLines, TOOLTIP_LINE_CHARACTER_LIMIT } from '../../../components/ui/MineoTooltipContent';

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
    expect(TOOLTIP_LINE_CHARACTER_LIMIT).toBe(60);
  });
});

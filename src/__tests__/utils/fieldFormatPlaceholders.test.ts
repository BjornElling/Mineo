import {
  DATE_FORMAT_PLACEHOLDER,
  DAY_FORMAT_PLACEHOLDER,
  MONTH_FORMAT_PLACEHOLDER,
  WEEK_FORMAT_PLACEHOLDER,
  YEAR_FORMAT_PLACEHOLDER,
} from '../../utils/fieldFormatPlaceholders';
import { DEFAULT_AMOUNT_PLACEHOLDER } from '../../utils/amountInputUtils';
import { DEFAULT_PERCENT_PLACEHOLDER } from '../../utils/percentInputUtils';

// En placeholder beskriver UDELUKKENDE værdiens form. De brugervendte assertions kører gennem den
// ægte side (`Aarsloen.integration.test.tsx`); her pinnes selve KONSTANTERNE, så et fremtidigt "hjælpsomt"
// tillæg til én af dem ikke slipper igennem uden at nogen har set reglen.

const ALL_FORMAT_PLACEHOLDERS = [
  YEAR_FORMAT_PLACEHOLDER,
  WEEK_FORMAT_PLACEHOLDER,
  DATE_FORMAT_PLACEHOLDER,
  MONTH_FORMAT_PLACEHOLDER,
  DAY_FORMAT_PLACEHOLDER,
  DEFAULT_AMOUNT_PLACEHOLDER,
  DEFAULT_PERCENT_PLACEHOLDER,
] as const;

describe('format-placeholders pr. feltfamilie', () => {
  it('har de rene, forventede former', () => {
    expect(YEAR_FORMAT_PLACEHOLDER).toBe('åååå');
    expect(WEEK_FORMAT_PLACEHOLDER).toBe('uu/åååå');
    expect(DATE_FORMAT_PLACEHOLDER).toBe('dd-mm-åååå');
    expect(MONTH_FORMAT_PLACEHOLDER).toBe('mm');
    expect(DAY_FORMAT_PLACEHOLDER).toBe('dd');
  });

  it('INGEN bærer et grænsesymbol', () => {
    // `åååå (≤2026)` var den konkrete regression: en valideringsgrænse i formvejledningens kanal.
    for (const placeholder of ALL_FORMAT_PLACEHOLDERS) {
      expect(placeholder).not.toMatch(/[≤≥<>]/);
    }
  });

  it('INGEN indeholder et konkret årstal – teksten må ikke ændre sig med kalenderen', () => {
    for (const placeholder of ALL_FORMAT_PLACEHOLDERS) {
      expect(placeholder).not.toMatch(/\d{4}/);
    }
  });

  it('INGEN bærer en enhed; enheden er et adornment (ét enheds-sted)', () => {
    for (const placeholder of ALL_FORMAT_PLACEHOLDERS) {
      expect(placeholder).not.toMatch(/kr\.?|%/);
    }
  });

  it('INGEN bærer en status- eller manglende-værdi-besked', () => {
    for (const placeholder of ALL_FORMAT_PLACEHOLDERS) {
      expect(placeholder).not.toMatch(/mangler|fejl|ugyldig/i);
    }
  });
});

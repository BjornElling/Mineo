import {
  buildNoValidDateRangeMessage,
  formatISODateForTooltip,
  isNonEmptyString,
} from '../../../domain/erstatningsopgoerelse/validation/eoDateRangeMessages';
import { toISODateString, type ISODateString } from '../../../types/branded';

const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;

describe('eoDateRangeMessages', () => {
  it('genkender kun definerede strenge med indhold', () => {
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString('tekst')).toBe(true);
  });

  it('formaterer en gyldig ISO-dato og bevarer en ugyldig fallback-værdi', () => {
    expect(formatISODateForTooltip(toISODateString('2024-03-07'))).toBe('07-03-2024');
    expect(formatISODateForTooltip(invalidIso('ikke-en-dato'))).toBe('ikke-en-dato');
  });

  it('viser den konkrete årsag til et umuligt datointerval', () => {
    expect(buildNoValidDateRangeMessage({
      minDate: toISODateString('2024-06-01'),
      maxDate: toISODateString('2024-05-31'),
      noValidRangeCause: 'skadedatoen',
    })).toBe(
      'Ingen gyldige datoer: min-dato (01-06-2024) er efter max-dato (31-05-2024). '
      + 'Værdien afgrænses af: skadedatoen'
    );
  });

  it.each([undefined, '   '])('bruger standardforklaringen uden en reel årsag (%s)', (cause) => {
    expect(buildNoValidDateRangeMessage({
      minDate: toISODateString('2024-06-01'),
      maxDate: toISODateString('2024-05-31'),
      noValidRangeCause: cause,
    })).toBe(
      'Ingen gyldige datoer: min-dato (01-06-2024) er efter max-dato (31-05-2024). '
      + 'Kontrollér de felter der bestemmer datointervallet.'
    );
  });
});

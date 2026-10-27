import {
  formatOverenskomstUdenSatserTekst,
  resolveLockedOverenskomstSatsTooltip,
  resolveSatsForReguleringsdato,
} from '../../../domain/loen/overenskomstSatser';
import { toISODateString } from '../../../types/branded';

describe('overenskomstSatser – fælles låste felter', () => {
  it('viser satsens dato i forklaringen til et låst felt', () => {
    expect(resolveLockedOverenskomstSatsTooltip(
      { kind: 'overenskomst', value: 10.15 }, null, toISODateString('2025-03-01'),
    )).toBe('Fastsat af overenskomsten på 01-03-2025');
    expect(resolveLockedOverenskomstSatsTooltip(
      { kind: 'overenskomst', value: 0 }, null, undefined,
    )).toBe('Fastsat af overenskomsten');
  });

  it('forklarer manglende satsdækning uden at fremvise tidligere manuel sats', () => {
    const daekning = {
      overenskomstId: 'bygge-anlaeg',
      foersteSatsDato: toISODateString('2011-03-01'),
    };
    expect(resolveLockedOverenskomstSatsTooltip(
      { kind: 'utilgaengelig' }, daekning, toISODateString('2010-01-01'),
    )).toBe(formatOverenskomstUdenSatserTekst(daekning));
    expect(resolveSatsForReguleringsdato({ kind: 'utilgaengelig' }, 12)).toBeUndefined();
  });

  it('skelner mellem overenskomstens udtrykkelige nul og en fri manuel sats', () => {
    expect(resolveSatsForReguleringsdato({ kind: 'overenskomst', value: 0 }, 12)).toBe(0);
    expect(resolveSatsForReguleringsdato({ kind: 'bruger' }, 12)).toBe(12);
  });
});

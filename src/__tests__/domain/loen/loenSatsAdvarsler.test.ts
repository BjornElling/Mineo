import { resolveHoejFeriePctAdvarsel } from '../../../domain/loen/feriePctAdvarsel';
import { resolveFravalgtStoreBededagstillaegAdvarsel } from '../../../domain/loen/storeBededagstillaeg';
import { toISODateString } from '../../../types/branded';

describe('fælles lønsatsadvarsler', () => {
  it('advarer først over 20 % og ændrer ikke de to domæners forskellige lave feriesatser', () => {
    for (const sats of [undefined, 0, 1, 12, 12.5, 15, 20]) {
      expect(resolveHoejFeriePctAdvarsel(sats)).toBeUndefined();
    }
    expect(resolveHoejFeriePctAdvarsel(20.01)).toBe(
      'Feriegodtgørelse/-tillæg over 20 % er usædvanligt – kontrollér satsen',
    );
  });

  it('advarer kun ved fravalg med almindelig løn og relevant dato fra 2024', () => {
    const valg = { loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false };
    expect(resolveFravalgtStoreBededagstillaegAdvarsel(toISODateString('2024-01-01'), valg)).toBe(
      'Der vil sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.',
    );
    expect(resolveFravalgtStoreBededagstillaegAdvarsel(undefined, valg)).toBeUndefined();
    expect(resolveFravalgtStoreBededagstillaegAdvarsel(toISODateString('2023-12-31'), valg)).toBeUndefined();
    expect(resolveFravalgtStoreBededagstillaegAdvarsel(toISODateString('2024-01-01'), {
      ...valg, beregnStoreBededagstillaeg: true,
    })).toBeUndefined();
    for (const loenPaaHelligdage of ['SH-udbetaling', 'Ingen']) {
      expect(resolveFravalgtStoreBededagstillaegAdvarsel(toISODateString('2024-01-01'), {
        ...valg, loenPaaHelligdage,
      })).toBeUndefined();
    }
  });
});

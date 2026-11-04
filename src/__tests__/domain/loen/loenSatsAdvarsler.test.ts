import {
  ferieYdelseNavn,
  FERIE_PCT_OVER_MAKS_BESKED,
  resolveFaellesFerieYdelse,
  resolveFerieYdelse,
  resolveHoejFeriePctAdvarsel,
} from '../../../domain/loen/feriePctYdelse';
import { resolveFravalgtStoreBededagstillaegAdvarsel } from '../../../domain/loen/storeBededagstillaeg';
import { toISODateString } from '../../../types/branded';

describe('fælles lønsatsadvarsler', () => {
  it('advarer først over 20 % og tier over 25 %, hvor feltet har sin egen røde fejl', () => {
    for (const sats of [undefined, 0, 1, 12, 12.5, 15, 20, 25.01, 30]) {
      expect(resolveHoejFeriePctAdvarsel(sats)).toBeUndefined();
    }
    for (const sats of [20.01, 25]) {
      expect(resolveHoejFeriePctAdvarsel(sats)).toBe('Feriegodtgørelse over 20 % er usædvanligt – kontrollér satsen');
    }
    expect(FERIE_PCT_OVER_MAKS_BESKED).toBe('Feriegodtgørelse kan ikke overstige 25 %');
  });

  it('navngiver satsen efter ydelsen: under 12 % ferietillæg, ellers feriegodtgørelse (udviklerafgørelse 2026-11-04)', () => {
    for (const sats of [0, 1, 2.95, 11.99]) {
      expect(resolveFerieYdelse(sats)).toBe('ferietillaeg');
      expect(ferieYdelseNavn(sats)).toBe('Ferietillæg');
    }
    for (const sats of [12, 12.5, 15, 16.95, 25]) {
      expect(resolveFerieYdelse(sats)).toBe('feriegodtgoerelse');
      expect(ferieYdelseNavn(sats)).toBe('Feriegodtgørelse');
    }
    // Uden sats er der ingen ydelse at navngive – feltets eget navn.
    expect(ferieYdelseNavn(undefined)).toBe('Feriegodtgørelse/-tillæg');
  });

  it('giver en fælles ydelse kun, når alle satser er samme ydelse', () => {
    expect(resolveFaellesFerieYdelse([12.5, 15])).toBe('feriegodtgoerelse');
    expect(resolveFaellesFerieYdelse([1, 2.95])).toBe('ferietillaeg');
    expect(resolveFaellesFerieYdelse([1, 12.5])).toBeUndefined();
    expect(resolveFaellesFerieYdelse([])).toBeUndefined();
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

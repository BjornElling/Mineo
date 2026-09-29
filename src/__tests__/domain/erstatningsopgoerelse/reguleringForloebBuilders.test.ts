import type * as KlModule from '../../../data/klLoenaftaler';
import type { DanishDateString } from '../../../types/branded';
import {
  buildKlLoenaftalerIndexEntries,
} from '../../../domain/erstatningsopgoerelse/engines/klLoenaftalerRegulering';
import {
  buildStatistikForloeb,
  buildStatistikIndexEntries,
} from '../../../domain/erstatningsopgoerelse/engines/statistikRegulering';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';
import type { StatistiskLoenudviklingId } from '../../../data/statistiskeRates';
import * as statistikRatesData from '../../../data/statistiskeRates';
import { toISODateString } from '../../../types/branded';

vi.mock('../../../data/klLoenaftaler', async (importActual) => {
  const actual = await importActual<typeof KlModule>();
  return {
    ...actual,
    klLoenaftalerRaekker: [
      ...actual.klLoenaftalerRaekker,
      { fraDato: 'ugyldig-dato' as DanishDateString, reguleringPct: 1.3 },
    ],
  };
});

const statistikId = (value: string): StatistiskLoenudviklingId => value as StatistiskLoenudviklingId;

describe('autoritative reguleringsforløb-byggere', () => {
  it('bygger statistikindeks sorteret fra ældste kvartal og bærer præcisionen med', () => {
    const entries = buildStatistikIndexEntries(statistikId('ILON12'));
    const forloeb = buildStatistikForloeb(statistikId('ILON12'));

    expect(entries[0]).toMatchObject({ startIso: toISODateString('2005-01-01'), kvartal: '2005K1' });
    expect(entries.at(-1)).toMatchObject({ startIso: toISODateString('2025-10-01'), kvartal: '2025K4' });
    expect(entries.map((entry) => entry.startIso)).toEqual(
      [...entries].sort((a, b) => a.startIso.localeCompare(b.startIso)).map((entry) => entry.startIso)
    );
    expect(forloeb).toMatchObject({ kind: 'statistik', entries, displayDecimals: 1 });
  });

  it('returnerer tom statistikserie og undefined-forløb for ukendt model', () => {
    const unknownModel = statistikId('UKENDT');

    expect(buildStatistikIndexEntries(unknownModel)).toEqual([]);
    expect(buildStatistikForloeb(unknownModel)).toBeUndefined();
  });

  it('filtrerer uparsbare kvartaler og kvartaler uden gyldig ISO-startdato', () => {
    const spy = vi.spyOn(statistikRatesData, 'getStatistiskLoenudvikling').mockReturnValue({
      meta: {
        id: statistikId('TEST'),
        navn: 'Test',
        hjaelpetekst: 'Test',
      },
      indeksvaerdier: [
        { kvartal: 'ikke-et-kvartal' as statistikRatesData.Kvartal, indeksvaerdi: 1 },
        { kvartal: '0000K1' as statistikRatesData.Kvartal, indeksvaerdi: 2 },
        { kvartal: '2024K1' as statistikRatesData.Kvartal, indeksvaerdi: 3 },
      ],
    });

    try {
      expect(buildStatistikIndexEntries(statistikId('TEST'))).toEqual([{
        startIso: toISODateString('2024-01-01'),
        kvartal: '2024K1',
        indeksvaerdi: 3,
      }]);
    } finally {
      spy.mockRestore();
    }
  });

  it('bygger KL-lønaftaleserien stigende og filtrerer en uparsbar kildedato', () => {
    const entries = buildKlLoenaftalerIndexEntries();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBe(klLoenaftalerRaekker.length - 1);
    expect(entries[0]).toMatchObject({ startIso: toISODateString('2005-04-01'), reguleringsPct: 0 });
    expect(entries.at(-1)?.startIso).toBe(toISODateString('2026-10-01'));
    expect(entries.some((entry) => String(entry.startIso) === 'ugyldig-dato')).toBe(false);
    expect(entries).toEqual([...entries].sort((a, b) => a.startIso.localeCompare(b.startIso)));
  });
});

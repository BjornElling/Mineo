import type { LoenudviklingManuelProcentsatsRow } from '../../../schemas/formSchemas';
import {
  buildManuelProcentsatsEntries,
  findManuelProcentsatsEntryForDate,
} from '../../../domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const row = (id: string, dato: string | undefined, procent: number | undefined): LoenudviklingManuelProcentsatsRow => ({
  id,
  dato: dato === undefined ? undefined : iso(dato),
  procent,
});

describe('buildManuelProcentsatsEntries', () => {
  it('akkumulerer procenter multiplikativt fra basisindeks 100', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [row('base', undefined, 0), row('r1', '2024-06-01', 10), row('r2', '2025-01-01', 10)],
    });
    expect(entries.map((entry) => entry.akkumuleretPct)).toEqual([0, expect.closeTo(10, 10), expect.closeTo(21, 10)]);
  });

  it('udelader rækker dateret før reguleringsdatoen fra akkumuleringen og holder entries sorteret', () => {
    // Rækken pr. 2023-06-01 ligger før basisdatoen. Tidligere indgik den både i den akkumulerede
    // procent OG brød entries-listens sortering (basis-entryen ligger forrest med senere dato),
    // så dato-opslag kunne returnere en forkert entry.
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [row('base', undefined, 0), row('foer-basis', '2023-06-01', 50), row('efter-basis', '2025-01-01', 10)],
    });

    expect(entries.map((entry) => entry.rowId)).toEqual(['base', 'efter-basis']);
    expect(entries.map((entry) => entry.akkumuleretPct)).toEqual([0, expect.closeTo(10, 10)]);
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i - 1].startIso <= entries[i].startIso).toBe(true);
    }

    // Datoer mellem basis og første aktive række slår op i basis-entryen (0 %), ikke pre-basis-rækken.
    expect(findManuelProcentsatsEntryForDate(entries, iso('2024-06-01'))?.akkumuleretPct).toBe(0);
    expect(findManuelProcentsatsEntryForDate(entries, iso('2025-06-01'))?.akkumuleretPct).toBeCloseTo(10, 10);
  });

  it('udelader også en række dateret præcis på reguleringsdatoen', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [row('base', undefined, 0), row('paa-basis', '2024-01-01', 5)],
    });
    expect(entries.map((entry) => entry.rowId)).toEqual(['base']);
    expect(findManuelProcentsatsEntryForDate(entries, iso('2024-01-01'))?.akkumuleretPct).toBe(0);
  });

  it('filtrerer rækker uden gyldig dato eller procent fra (dækkes af validatorens blokerende krav)', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [row('base', undefined, 0), row('uden-dato', undefined, 10), row('uden-procent', '2024-06-01', undefined)],
    });
    expect(entries.map((entry) => entry.rowId)).toEqual(['base']);
  });

  it('returnerer tom serie når den anvendte reguleringsdato mangler', () => {
    expect(buildManuelProcentsatsEntries({
      anvendtReguleringsdato: undefined,
      rows: [row('base', undefined, 0), row('r1', '2024-06-01', 10)],
    })).toEqual([]);
  });

  it('bruger et stabilt basis-id når rækkelisten er tom', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.rowId).toBe('manuel-procentsats-base');
  });

  it('bevarer originalrækkefølgen for samme reguleringsdato og har tom lookup-fallback', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [
        row('base', undefined, 0),
        row('første-samme-dato', '2024-06-01', 10),
        row('anden-samme-dato', '2024-06-01', 5),
      ],
    });

    expect(entries.map((entry) => entry.rowId)).toEqual(['base', 'første-samme-dato', 'anden-samme-dato']);
    expect(findManuelProcentsatsEntryForDate([], iso('2024-06-01'))).toBeUndefined();
  });
});

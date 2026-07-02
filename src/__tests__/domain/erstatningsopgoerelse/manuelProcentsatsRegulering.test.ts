import type { LoenudviklingManuelProcentsatsRow } from '../../../schemas/formSchemas';
import {
  buildManuelProcentsatsEntries,
  findManuelProcentsatsEntryForDate,
  resolveManuelProcentsatsRowsFoerBasis,
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

  it('medtager en række dateret præcis på reguleringsdatoen — gældende fra reguleringsdatoen', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [row('base', undefined, 0), row('paa-basis', '2024-01-01', 5)],
    });
    expect(entries.map((entry) => entry.rowId)).toEqual(['base', 'paa-basis']);
    // Opslag på selve reguleringsdatoen rammer brugerrækken (5 %), ikke basis-entryen.
    expect(findManuelProcentsatsEntryForDate(entries, iso('2024-01-01'))?.akkumuleretPct).toBeCloseTo(5, 10);
  });

  it('filtrerer rækker uden gyldig dato eller procent fra (dækkes af validatorens blokerende krav)', () => {
    const entries = buildManuelProcentsatsEntries({
      anvendtReguleringsdato: iso('2024-01-01'),
      rows: [row('base', undefined, 0), row('uden-dato', undefined, 10), row('uden-procent', '2024-06-01', undefined)],
    });
    expect(entries.map((entry) => entry.rowId)).toEqual(['base']);
  });
});

describe('resolveManuelProcentsatsRowsFoerBasis', () => {
  it('returnerer netop rækkerne med dato før reguleringsdatoen (til advarselsrækken)', () => {
    const foerBasis = row('foer-basis', '2023-06-01', 50);
    const rows = [row('base', undefined, 0), foerBasis, row('paa-basis', '2024-01-01', 5), row('efter-basis', '2025-01-01', 10)];
    expect(resolveManuelProcentsatsRowsFoerBasis({ anvendtReguleringsdato: iso('2024-01-01'), rows })).toEqual([foerBasis]);
  });

  it('returnerer tom liste uden reguleringsdato', () => {
    expect(resolveManuelProcentsatsRowsFoerBasis({ anvendtReguleringsdato: undefined, rows: [row('r1', '2023-06-01', 50)] })).toEqual([]);
  });
});

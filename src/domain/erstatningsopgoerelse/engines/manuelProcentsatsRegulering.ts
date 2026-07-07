import type { LoenudviklingManuelProcentsatsRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString } from '../../../types/branded';
import { hasFinitePct } from '../helpers/manuelReguleringRowPredicates';
import { findLatestByDateInSortedList } from './reguleringSeriesLookup';

export const MANUEL_PROCENTSATS_BASE_INDEX = 100;

export type ManuelProcentsatsEntry = Readonly<{
  rowId: string;
  startIso: ISODateString;
  procent: number;
  indeks: number;
  akkumuleretPct: number;
  isBase: boolean;
}>;

// R2 — det autoritative regulerings-visnings-forløb, emitteret af motoren (LoenudviklingModel)
// og LÆST af præsentation/inspektion, så det viste forløb er samme kilde som beløbet.
// Diskrimineret union pr. reguleringsform; kun 'manuelProcentsats' er migreret indtil videre
// (jf. docs/review/regulering-arkitektur-redesign.md R2 skridt 6). De øvrige former re-deriverer
// fortsat og repræsenteres ved fravær (undefined) på modellen, indtil de migreres.
export type ReguleringForloeb = Readonly<{
  kind: 'manuelProcentsats';
  entries: readonly ManuelProcentsatsEntry[];
}>;

/**
 * Rækker dateret FØR den anvendte reguleringsdato indgår ikke i akkumuleringen (basisrækken
 * repræsenterer allerede niveauet/indeks 100 pr. reguleringsdatoen). De ignoreres i beregningen
 * og rapporteres i stedet som en advarsel via `resolveManuelProcentsatsRowsFoerBasis`.
 * Rækker dateret PRÆCIS på reguleringsdatoen er tilladt og gælder fra reguleringsdatoen.
 */
export const resolveManuelProcentsatsRowsFoerBasis = (args: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  rows: readonly LoenudviklingManuelProcentsatsRow[];
}>): readonly LoenudviklingManuelProcentsatsRow[] => {
  const baseIso = args.anvendtReguleringsdato;
  if (!baseIso) return [];
  return args.rows
    .slice(1)
    .filter((row) => isISODateString(row.dato) && row.dato < baseIso);
};

export const buildManuelProcentsatsEntries = (args: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  rows: readonly LoenudviklingManuelProcentsatsRow[];
}>): readonly ManuelProcentsatsEntry[] => {
  const baseIso = args.anvendtReguleringsdato;
  if (!baseIso) return [];

  const baseRow = args.rows[0];
  const entries: ManuelProcentsatsEntry[] = [{
    rowId: baseRow?.id ?? 'manuel-procentsats-base',
    startIso: baseIso,
    procent: 0,
    indeks: MANUEL_PROCENTSATS_BASE_INDEX,
    akkumuleretPct: 0,
    isBase: true,
  }];

  let runningIndex = MANUEL_PROCENTSATS_BASE_INDEX;
  const userRows = args.rows
    .slice(1)
    .map((row, originalIndex) => ({ row, originalIndex }))
    .filter((entry): entry is Readonly<{ row: LoenudviklingManuelProcentsatsRow & { dato: ISODateString; procent: number }; originalIndex: number }> =>
      isISODateString(entry.row.dato) && hasFinitePct(entry.row.procent)
    )
    // Rækker før reguleringsdatoen ignoreres (se resolveManuelProcentsatsRowsFoerBasis) — de ville
    // ellers både forvride den akkumulerede procent og bryde entries-listens sortering, som
    // findManuelProcentsatsEntryForDate forudsætter.
    .filter((entry) => entry.row.dato >= baseIso)
    .sort((a, b) => {
      const byDate = a.row.dato.localeCompare(b.row.dato);
      return byDate === 0 ? a.originalIndex - b.originalIndex : byDate;
    });

  for (const { row } of userRows) {
    runningIndex *= 1 + row.procent / 100;
    entries.push({
      rowId: row.id,
      startIso: row.dato,
      procent: row.procent,
      indeks: runningIndex,
      akkumuleretPct: runningIndex - MANUEL_PROCENTSATS_BASE_INDEX,
      isBase: false,
    });
  }

  return entries;
};

// Forudsætter at entries er sorteret stigende på startIso — det garanterer
// buildManuelProcentsatsEntries ved konstruktion (basisrækken først, brugerrækker ≥ basisdato
// i datoorden). En række dateret præcis på basisdatoen ligger EFTER basis-entryen og vinder
// derfor opslaget fra og med reguleringsdatoen (bevidst: reguleringen gælder fra dag ét).
//
// Deler det fælles carry-forward-opslag (regulering-redesign R3); den ene afvigelse fra det
// generiske opslag er fallback: ligger `iso` før alle entries, anvendes basisrækken (`entries[0]`,
// indeks 100) frem for `undefined` — basisrækken repræsenterer altid niveauet pr. reguleringsdatoen.
export const findManuelProcentsatsEntryForDate = (
  entries: readonly ManuelProcentsatsEntry[],
  iso: ISODateString
): ManuelProcentsatsEntry | undefined =>
  findLatestByDateInSortedList(entries, iso, 'manuelProcentsats:lookup') ?? entries[0];

import type { LoenudviklingManuelProcentsatsRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString } from '../../../types/branded';
import {
  hasFinitePct,
  isManualRegulationDateOnOrBeforeBasis,
} from '../helpers/manuelReguleringRowPredicates';
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
    // Gaten gør disse rækker røde. Motoren afviser dem også defensivt, så en omgået UI-gate aldrig
    // kan lade en ekstra regulering på eller før basisankeret påvirke resultatet.
    .filter((entry) => !isManualRegulationDateOnOrBeforeBasis(entry.row.dato, baseIso))
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

// Forudsætter at entries er sorteret stigende på startIso – det garanterer
// buildManuelProcentsatsEntries ved konstruktion (basisrækken først, brugerrækker > basisdato
// i datoorden).
//
// Deler det fælles carry-forward-opslag (regulering-redesign R3); den ene afvigelse fra det
// generiske opslag er fallback: ligger `iso` før alle entries, anvendes basisrækken (`entries[0]`,
// indeks 100) frem for `undefined` – basisrækken repræsenterer altid niveauet pr. reguleringsdatoen.
export const findManuelProcentsatsEntryForDate = (
  entries: readonly ManuelProcentsatsEntry[],
  iso: ISODateString
): ManuelProcentsatsEntry | undefined =>
  findLatestByDateInSortedList(entries, iso, 'manuelProcentsats:lookup') ?? entries[0];

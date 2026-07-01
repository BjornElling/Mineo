import type { LoenudviklingManuelProcentsatsRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString } from '../../../types/branded';

export const MANUEL_PROCENTSATS_BASE_INDEX = 100;

export type ManuelProcentsatsEntry = Readonly<{
  rowId: string;
  startIso: ISODateString;
  procent: number;
  indeks: number;
  akkumuleretPct: number;
  isBase: boolean;
}>;

const isFinitePct = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

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
      isISODateString(entry.row.dato) && isFinitePct(entry.row.procent)
    )
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

export const findManuelProcentsatsEntryForDate = (
  entries: readonly ManuelProcentsatsEntry[],
  iso: ISODateString
): ManuelProcentsatsEntry | undefined => {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].startIso <= iso) return entries[i];
  }
  return entries[0];
};

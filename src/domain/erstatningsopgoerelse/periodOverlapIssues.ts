import { toAnyFieldRef, type FieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import { isoToDanish, type ISODateString } from '../../types/branded';
import { isValidClosedDateRange, rangesOverlap, type ClosedDateRange } from '../../utils/closedDateRange';
import type { PeriodRow } from './engines/periodOverlapDetection';

type DateFieldRef = FieldRef<ISODateString | undefined>;
type RowDateField = FieldDescriptor<ISODateString | undefined>;

/** Én periode i en kilde: dens datoer og de to felter, overlappet farver. */
export type PeriodOverlapEntry = Readonly<{
  id: string;
  fra?: ISODateString | undefined;
  til?: ISODateString | undefined;
  fields: Readonly<{ fra: DateFieldRef; til: DateFieldRef }>;
}>;

/**
 * En kilde af perioder – en tabel eller et skalart datopar (fx beregningsperioden).
 *
 * `navn` er periodens navn set fra en ANDEN kilde i bestemt form («TAF-perioden», «beregningsperioden»); det
 * står i modpartens tooltip. Inden for samme kilde hedder modparten blot «perioden».
 */
export type PeriodOverlapSource = Readonly<{
  id: string;
  navn: Readonly<{ ental: string; flertal: string }>;
  entries: readonly PeriodOverlapEntry[];
  /** Prøves rækkerne indbyrdes? Et skalart datopar har kun én periode og sammenlignes kun med andre kilder. */
  indbyrdes: boolean;
}>;

type Partner = Readonly<{ sourceId: string; range: ClosedDateRange }>;

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;
const rangeText = (range: ClosedDateRange): string => `${danish(range.fra)} - ${danish(range.til)}`;

const validRange = (entry: PeriodOverlapEntry): ClosedDateRange | undefined => {
  const range = { fra: entry.fra, til: entry.til };
  return isValidClosedDateRange(range) ? range : undefined;
};

/**
 * Programmets ENE overlaps-regel for fra/til-perioder, projekteret til de konkrete datoceller.
 *
 * Overlap spærrede opgørelsen gennem rækkeevalueringen, men uden en feltadresse og dermed uden rød celle –
 * mens datoorden, afskæringer og feltets egne grænser på de samme celler farvede dem. Fraværet af rød kant
 * læses som «denne celle er kontrolleret og i orden» (BB-218 for svie/smerte, BB-251 for TAF- og
 * ferieperioderne, BB-262 for beregningsperioden mod TAF-perioderne). BEGGE celler i BEGGE perioder markeres:
 * perioden er ét hele, og brugeren kan rette overlappet fra hvilken som helst af de to ender.
 *
 * Reglen tager vilkårligt mange kilder, så overlap INDEN FOR en tabel og MELLEM to kilder (et skalart datopar
 * mod en tabel) går samme vej og giver samme form (udviklerønske 2026-10-02: én samlet, gennemtænkt løsning).
 * Overlapper en celle flere modparter – fx en anden TAF-periode OG beregningsperioden – samles de i ÉN besked,
 * fordi issue-snapshottet kun bærer ét aktivt issue pr. felt (§1.8).
 *
 * **Tooltippen navngiver modparten.** «Fejl og advarsler» viser én linje pr. tabel om overlap, så boksen
 * siger ikke, hvilke rækker der er tale om; det gør den røde celles tooltip.
 *
 * En ufuldstændig eller omvendt periode overlapper bevidst intet – dens mangel er brugerens fejl et andet sted –
 * og to perioder, der blot deler en endedato, overlapper (udviklerbeslutning 2026-09-17). Prædikatet er
 * `rangesOverlap`, det samme som `periodOverlapDetection.ts` bruger.
 */
export const collectSourcesOverlapIssues = (
  sources: readonly PeriodOverlapSource[],
  pairs: ReadonlyArray<readonly [string, string]> = [],
): readonly FieldIssue[] => {
  const partnersByKey = new Map<string, Partner[]>();
  const entryByKey = new Map<string, PeriodOverlapEntry>();
  const keyOf = (sourceId: string, entryId: string): string => `${sourceId}\u0000${entryId}`;
  const addPartner = (sourceId: string, entry: PeriodOverlapEntry, partner: Partner): void => {
    const key = keyOf(sourceId, entry.id);
    entryByKey.set(key, entry);
    const existing = partnersByKey.get(key);
    if (existing === undefined) partnersByKey.set(key, [partner]);
    else existing.push(partner);
  };

  // Parvis på rækkernes plads, ikke på id: modparten er den række, der faktisk overlapper, også hvis to rækker
  // (fejlagtigt) deler id.
  for (const source of sources) {
    if (!source.indbyrdes) continue;
    const ranges = source.entries.map(validRange);
    for (let i = 0; i < source.entries.length; i += 1) {
      const left = ranges[i];
      if (left === undefined) continue;
      for (let j = i + 1; j < source.entries.length; j += 1) {
        const right = ranges[j];
        if (right === undefined || !rangesOverlap(left, right)) continue;
        addPartner(source.id, source.entries[i]!, { sourceId: source.id, range: right });
        addPartner(source.id, source.entries[j]!, { sourceId: source.id, range: left });
      }
    }
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const [leftId, rightId] of pairs) {
    const left = sourceById.get(leftId);
    const right = sourceById.get(rightId);
    if (left === undefined || right === undefined) continue;
    for (const leftEntry of left.entries) {
      const leftRange = validRange(leftEntry);
      if (leftRange === undefined) continue;
      for (const rightEntry of right.entries) {
        const rightRange = validRange(rightEntry);
        if (rightRange === undefined || !rangesOverlap(leftRange, rightRange)) continue;
        addPartner(left.id, leftEntry, { sourceId: right.id, range: rightRange });
        addPartner(right.id, rightEntry, { sourceId: left.id, range: leftRange });
      }
    }
  }

  const buildMessage = (ownSourceId: string, partners: readonly Partner[]): string => {
    const grupper = new Map<string, ClosedDateRange[]>();
    for (const partner of partners) {
      const gruppe = grupper.get(partner.sourceId);
      if (gruppe === undefined) grupper.set(partner.sourceId, [partner.range]);
      else gruppe.push(partner.range);
    }
    const dele = [...grupper.entries()].map(([sourceId, ranges]) => {
      const sorted = [...ranges].sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
      const navn = sourceId === ownSourceId
        ? { ental: 'perioden', flertal: 'perioderne' }
        : sourceById.get(sourceId)?.navn ?? { ental: 'perioden', flertal: 'perioderne' };
      return sorted.length === 1
        ? `${navn.ental} ${rangeText(sorted[0]!)}`
        : `${navn.flertal} ${sorted.map(rangeText).join(' og ')}`;
    });
    return `Perioden overlapper ${dele.join(' og ')}`;
  };

  return [...partnersByKey.entries()].flatMap(([key, partners]) => {
    const entry = entryByKey.get(key);
    if (entry === undefined) return [];
    const ownSourceId = key.slice(0, key.indexOf('\u0000'));
    const message = buildMessage(ownSourceId, partners);
    return [entry.fields.fra, entry.fields.til].map((field) =>
      Object.freeze({
        kind: 'field' as const,
        code: `${field.descriptor.id}.overlap`,
        severity: 'error' as const,
        field: toAnyFieldRef(field),
        reason: 'rule' as const,
        message,
      }));
  });
};

/** Bygger en tabel-kilde ud fra rækker og tabellens to datodescriptorer (bundet pr. række-id). */
export const tableOverlapSource = (
  id: string,
  navn: PeriodOverlapSource['navn'],
  rows: readonly PeriodRow[],
  fields: Readonly<{ fra: RowDateField; til: RowDateField }>,
): PeriodOverlapSource => ({
  id,
  navn,
  indbyrdes: true,
  entries: rows.map((row) => ({
    id: row.id,
    fra: row.fra,
    til: row.til,
    fields: { fra: fields.fra.bind(row.id), til: fields.til.bind(row.id) },
  })),
});

/** Overlap inden for ÉN tabel – den hyppigste form (svie/smerte, TAF, begge ferietabeller). */
export const collectPeriodOverlapIssues = (
  rows: readonly PeriodRow[],
  fields: Readonly<{ fra: RowDateField; til: RowDateField }>,
): readonly FieldIssue[] =>
  collectSourcesOverlapIssues([tableOverlapSource('tabel', { ental: 'perioden', flertal: 'perioderne' }, rows, fields)]);

/** Overlaps-issuets kode – rækkebyggerne skelner overlap (én linje pr. tabel) fra rækkens øvrige fejl. */
export const isPeriodOverlapIssue = (issue: Pick<FieldIssue, 'code'>): boolean => issue.code.endsWith('.overlap');

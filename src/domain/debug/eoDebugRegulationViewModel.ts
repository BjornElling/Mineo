/**
 * Regulation View Model - Indeks visning (rettet)
 */

import type { ISODateString } from '../../types/branded';
import { subtractOneDay } from '../../types/branded';
import type { DebugCellValue } from './eoDebugTypes';
import { formatIsoValue, formatAmountDisplay, formatDecimal, formatPercent } from './eoDebugFormat';
import type { RegulationIndexTimeline } from './eoDebugRegulationTypes';
import { TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/tafBeregningsenhed';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { resolveLoenudviklingKilde } from '../erstatningsopgoerelse/angivetLoenHelpers';
import { resolveReguleringsdato } from '../erstatningsopgoerelse/sharedPdfUtils';
import { getAngivetLoenOpreguleresFraDato } from '../erstatningsopgoerelse/angivetLoenHelpers';
import { computeTafBeregningsenhed } from '../erstatningsopgoerelse/tafBeregningsenhed';
import { buildReguleringIndexRows } from '../erstatningsopgoerelse/eoPdfReguleringEngine';

export type RegulationDebugSection = {
  readonly id: string;
  readonly header: string;
  readonly rows: readonly RegulationDebugRow[];
  readonly tables?: readonly RegulationDebugTable[];
};

export type RegulationDebugRow = {
  readonly id: string;
  readonly label: string;
  readonly value: DebugCellValue | string;
};

export type RegulationDebugTable = {
  readonly id: string;
  readonly columns: readonly string[];
  readonly rows: readonly RegulationDebugTableRow[];
};

export type RegulationDebugTableRow = {
  readonly id: string;
  readonly cells: readonly (DebugCellValue | string)[];
};

type RegulationColumnKey =
  | 'dato'
  | 'arbejdsdage'
  | 'maaneder'
  | 'grundloen'
  | 'ferie'
  | 'shSo'
  | 'fritvalg'
  | 'storeBededag'
  | 'pension'
  | 'pakke'
  | 'indeks';

const buildCurrencyCell = (value: number): DebugCellValue => ({
  rawValue: value,
  displayValue: formatAmountDisplay(value),
});

const buildPercentCell = (value: number): DebugCellValue => ({
  rawValue: value,
  displayValue: formatPercent(value, 2),
});

const buildIndexCell = (value: number): DebugCellValue => ({
  rawValue: value,
  displayValue: formatDecimal(value, 2),
});

const buildFallbackSegmentsFromTimeline = (params: Readonly<{
  entries: readonly RegulationIndexTimeline['ansaettelser'][number]['entries'][number][];
  tafBeregningsenhed: RegulationIndexTimeline['tafBeregningsenhed'];
  tafRanges: readonly Readonly<{ fra: ISODateString; til: ISODateString }>[];
}>): EoCanonicalOutput['regulering']['perAnsaettelse'][number]['loenudviklingSegmenter'] => {
  const { entries, tafBeregningsenhed, tafRanges } = params;
  if (entries.length === 0 || tafRanges.length === 0) return [];

  const sortedEntries = [...entries].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const segments: EoCanonicalOutput['regulering']['perAnsaettelse'][number]['loenudviklingSegmenter'] = [];

  for (const range of tafRanges) {
    const splitPoints = new Set<ISODateString>([range.fra]);
    sortedEntries.forEach((entry) => {
      if (entry.effectiveFrom > range.fra && entry.effectiveFrom <= range.til) {
        splitPoints.add(entry.effectiveFrom);
      }
    });
    const orderedStarts = [...splitPoints].sort((a, b) => a.localeCompare(b));

    orderedStarts.forEach((fra, index) => {
      const nextStart = orderedStarts[index + 1];
      const til = nextStart ? (subtractOneDay(nextStart) ?? range.til) : range.til;
      if (fra > til) return;

      const matchingEntry = [...sortedEntries]
        .filter((entry) => entry.effectiveFrom <= fra)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
      if (!matchingEntry) return;

      const deltaPct = matchingEntry.index - 100;
      if (tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
        segments.push({
          kind: 'maaneder',
          fra,
          til,
          maaneder: matchingEntry.maaneder ?? 0,
          maanedsloenOre: 0,
          deltaPct,
          amountOre: 0,
        });
        return;
      }

      segments.push({
        kind: 'arbejdsdage',
        fra,
        til,
        arbejdsdage: matchingEntry.arbejdsdage ?? 0,
        dagsloenOre: 0,
        deltaPct,
        amountOre: 0,
      });
    });
  }

  return segments;
};

const COLUMN_DEFS: ReadonlyArray<Readonly<{
  key: RegulationColumnKey;
  header: string;
  getCell: (entry: RegulationIndexTimeline['ansaettelser'][number]['entries'][number]) => DebugCellValue | string;
  shouldInclude: (
    timeline: RegulationIndexTimeline,
    entries: readonly RegulationIndexTimeline['ansaettelser'][number]['entries'][number][]
  ) => boolean;
}>> = [
  {
    key: 'dato',
    header: 'Dato',
    getCell: (entry) => ({ rawValue: entry.effectiveFrom, displayValue: formatIsoValue(entry.effectiveFrom) }),
    shouldInclude: () => true,
  },
  {
    key: 'arbejdsdage',
    header: 'Arbejdsdag',
    getCell: (entry) => ({
      rawValue: entry.arbejdsdage ?? 0,
      displayValue: entry.arbejdsdage !== null ? entry.arbejdsdage.toString() : '-',
    }),
    shouldInclude: (timeline) => timeline.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE,
  },
  {
    key: 'maaneder',
    header: 'Måneder',
    getCell: (entry) => ({
      rawValue: entry.maaneder ?? 0,
      displayValue: entry.maaneder !== null ? formatDecimal(entry.maaneder, 2) : '-',
    }),
    shouldInclude: (timeline) => timeline.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER,
  },
  {
    key: 'grundloen',
    header: 'Grundløn',
    getCell: (entry) => buildCurrencyCell(entry.grundloen),
    shouldInclude: (_timeline, entries) => entries.some((entry) => entry.grundloen !== 0),
  },
  {
    key: 'ferie',
    header: 'Ferie',
    getCell: (entry) => buildPercentCell(entry.feriePct),
    shouldInclude: (_timeline, entries) => entries.some((entry) => entry.feriePct !== 0),
  },
  {
    key: 'shSo',
    header: 'SH/SO',
    getCell: (entry) => buildPercentCell(entry.shSoPct),
    shouldInclude: (_timeline, entries) => entries.some((entry) => entry.shSoPct !== 0),
  },
  {
    key: 'fritvalg',
    header: 'Fritvalg',
    getCell: (entry) => buildPercentCell(entry.fritvalgPct),
    shouldInclude: (_timeline, entries) => entries.some((entry) => entry.fritvalgPct !== 0),
  },
  {
    key: 'storeBededag',
    header: 'Store Bededag',
    getCell: (entry) => buildPercentCell(entry.storeBededagPct),
    shouldInclude: (_timeline, entries) => entries.some((entry) => entry.storeBededagPct !== 0),
  },
  {
    key: 'pension',
    header: 'Pension',
    getCell: (entry) => buildPercentCell(entry.pensionPct),
    shouldInclude: (_timeline, entries) => entries.some((entry) => entry.pensionPct !== 0),
  },
];

/**
 * Byg regulation debug sections (indeks) pr. ansaettelsesforhold
 */
export function buildRegulationDebugSections(
  params: Readonly<{
    timeline: RegulationIndexTimeline;
    canonicalOutput?: EoCanonicalOutput;
    eoValues: ErstatningsopgoerelseValues;
    stamdataValues: StamdataValues;
  }>
): readonly RegulationDebugSection[] {
  const { timeline, canonicalOutput, eoValues, stamdataValues } = params;
  if (timeline.ansaettelser.length === 0) return [];

  const loenudviklingsKilderById = new Map(
    resolveLoenudviklingKilde(eoValues).map((ansaettelsesforhold) => [ansaettelsesforhold.id, ansaettelsesforhold] as const)
  );
  const canonicalSegmentsByEmploymentId = new Map(
    (canonicalOutput?.regulering.perAnsaettelse ?? []).map((entry) => [entry.ansaettelsesforholdId, entry.loenudviklingSegmenter] as const)
  );
  const tafRanges = (canonicalOutput?.periodiseringer.tafPerioder ?? eoValues.tafPerioder ?? [])
    .flatMap((range) => (range.fra && range.til ? [{ fra: range.fra, til: range.til }] : []));

  const sections: RegulationDebugSection[] = [];

  timeline.ansaettelser.forEach((af, idx) => {
    const header = af.navn && af.navn.trim() !== ''
      ? `Regulering (${af.navn.trim()})`
      : `Regulering (Ansættelsesforhold ${idx + 1})`;

    const latest = af.entries[af.entries.length - 1];
    const sectionId = `regulation.${af.ansaettelsesforholdId}`;
    const visibleColumns = COLUMN_DEFS.filter((column) => column.shouldInclude(timeline, af.entries));
    const rows: RegulationDebugRow[] = [
      {
        id: `${sectionId}:kilde`,
        label: af.kildeLabel,
        value: af.kildeVaerdi,
      },
      {
        id: `${sectionId}:skadesdato`,
        label: `Reguleringsdato (${af.referenceLabel})`,
        value: { rawValue: af.referenceIso, displayValue: formatIsoValue(af.referenceIso) },
      },
      {
        id: `${sectionId}:basisvaerdi`,
        label: 'Basisværdi (indeks 100)',
        value: buildCurrencyCell(af.referenceValue),
      },
      {
        id: `${sectionId}:seneste_indeks`,
        label: 'Seneste indeks',
        value: latest ? buildIndexCell(latest.index) : '-',
      },
    ];

    const tables: RegulationDebugTable[] = [{
      id: `${sectionId}:vaerdier`,
      columns: visibleColumns.map((column) => column.header),
      rows: af.entries.map((entry) => ({
        id: `regulation.table:${af.ansaettelsesforholdId}:${entry.effectiveFrom}`,
        cells: visibleColumns.map((column) => column.getCell(entry)),
      })),
    }];

    const ansaettelsesforhold = loenudviklingsKilderById.get(af.ansaettelsesforholdId);
    const canonicalSegments = canonicalSegmentsByEmploymentId.get(af.ansaettelsesforholdId) ?? [];
    const segmentsForDebug = canonicalSegments.length > 0
      ? canonicalSegments
      : buildFallbackSegmentsFromTimeline({
          entries: af.entries,
          tafBeregningsenhed: timeline.tafBeregningsenhed,
          tafRanges,
        });
    const reguleringsdato = ansaettelsesforhold
      ? resolveReguleringsdato({
          beregnesUdFra: eoValues.beregnesUdFra,
          angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
          saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
          skadesdato: stamdataValues.skadesdato,
        })
      : undefined;
    if (ansaettelsesforhold && segmentsForDebug.length > 0) {
      const indeksRows = buildReguleringIndexRows({
        segments: segmentsForDebug,
        ansaettelsesforhold,
        reguleringsdato,
        tafBeregningsenhed: computeTafBeregningsenhed(eoValues),
      });
      if (indeksRows.length > 0) {
        tables.push({
          id: `${sectionId}:beregnet`,
          columns: ['Fra-dato', 'Til-dato', 'Indeksberegning', 'Indeks', 'Lønudvikling'],
          rows: indeksRows.map((row, rowIndex) => ({
            id: `${sectionId}:beregnet:${rowIndex}`,
            cells: [row.fraDato, row.tilDato, row.indeksberegning, row.indeks, row.loenudvikling],
          })),
        });
      }
    }

    sections.push({
      id: sectionId,
      header,
      rows,
      tables,
    });
  });

  return sections;
}

import { getDayBeforeIso } from '../../utils/isoDateHelpers';
/**
 * Regulation View Model - Indeks visning (rettet)
 */

import type { ISODateString } from '../../types/branded';

import type { DebugCellValue } from '../eoRowEvaluation/eoRowTypes';
import { formatIsoValue, formatAmountDisplay, formatDecimal, formatPercent } from './eoDebugFormat';
import type { RegulationIndexTimeline } from './eoDebugRegulationTypes';
import { TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { resolveLoenudviklingKilde } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../erstatningsopgoerelse/helpers/eoSharedUtils';
import { getAngivetLoenOpreguleresFraDato } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { computeTafBeregningsenhed } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  buildReguleringIndexRows,
  buildReguleringsvaerdierTableData,
  resolveLoenudviklingSegmentBounds,
} from '../erstatningsopgoerelse/engines/reguleringsPresentation';

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
      const til = nextStart ? (getDayBeforeIso(nextStart) ?? range.til) : range.til;
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
    header: 'Feriepenge',
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

const resolveVisibleColumnHeader = (
  column: Readonly<{ key: RegulationColumnKey; header: string }>,
  timeline: RegulationIndexTimeline
): string => {
  if (column.key === 'grundloen') {
    return timeline.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE ? 'Timeløn' : 'Månedsløn';
  }
  return column.header;
};

const toComparableDebugCell = (cell: DebugCellValue | string): string =>
  typeof cell === 'string' ? cell : cell.displayValue;

const mergeConsecutiveDebugRows = (
  rows: readonly RegulationDebugTableRow[]
): readonly RegulationDebugTableRow[] => {
  if (rows.length <= 1) return rows;
  const merged: RegulationDebugTableRow[] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    const hasSameValues = Boolean(
      last &&
      last.cells.length === row.cells.length &&
      last.cells.slice(1).every((cell, index) => toComparableDebugCell(cell) === toComparableDebugCell(row.cells[index + 1]!))
    );
    if (!hasSameValues) {
      merged.push(row);
    }
  }
  return merged;
};

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

    const sectionId = `regulation.${af.ansaettelsesforholdId}`;
    const rows: RegulationDebugRow[] = [
      {
        id: `${sectionId}:kilde`,
        label: af.kildeLabel,
        value: af.kildeVaerdi,
      },
      {
        id: `${sectionId}:skadedato`,
        label: af.referenceLabel ? `Anvendt reguleringsdato (${af.referenceLabel})` : 'Anvendt reguleringsdato',
        value: { rawValue: af.referenceIso, displayValue: formatIsoValue(af.referenceIso) },
      },
    ];

    const ansaettelsesforhold = loenudviklingsKilderById.get(af.ansaettelsesforholdId);
    const isKlLoenaftalerAnsaettelsesforhold = ansaettelsesforhold?.loenudviklingBeregningsgrundlag === 'KL-lønaftaler';
    const canonicalSegments = canonicalSegmentsByEmploymentId.get(af.ansaettelsesforholdId) ?? [];
    const segmentsForDebug = canonicalSegments.length > 0
      ? canonicalSegments
      : isKlLoenaftalerAnsaettelsesforhold
        ? []
        : buildFallbackSegmentsFromTimeline({
          entries: af.entries,
          tafBeregningsenhed: timeline.tafBeregningsenhed,
          tafRanges,
        });
    const coverageBounds = resolveLoenudviklingSegmentBounds(segmentsForDebug);
    const anvendtReguleringsdato = ansaettelsesforhold
      ? resolveAnvendtReguleringsdato({
          beregnesUdFra: eoValues.beregnesUdFra,
          angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
          saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
          beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
          skadedato: stamdataValues.skadedato,
        })
      : undefined;
    const reguleringsvaerdierTableData =
      ansaettelsesforhold && coverageBounds
        ? buildReguleringsvaerdierTableData({
            ansaettelsesforhold,
            anvendtReguleringsdato,
            tafFra: coverageBounds.foerste,
            tafTil: coverageBounds.sidste,
            tafBeregningsenhed: computeTafBeregningsenhed(eoValues),
          })
        : null;
    const tables: RegulationDebugTable[] = [];
    if (reguleringsvaerdierTableData) {
      tables.push({
        id: `${sectionId}:vaerdier`,
        columns: reguleringsvaerdierTableData.columns,
        rows: reguleringsvaerdierTableData.rows.map((row, rowIndex) => ({
          id: `${sectionId}:vaerdier:${rowIndex}`,
          cells: row,
        })),
      });
    } else if (isKlLoenaftalerAnsaettelsesforhold) {
      tables.push({
        id: `${sectionId}:vaerdier`,
        columns: ['Dato', 'Regulering'],
        rows: af.entries.map((entry) => ({
          id: `regulation.table:${af.ansaettelsesforholdId}:${entry.effectiveFrom}`,
          cells: [
            { rawValue: entry.effectiveFrom, displayValue: formatIsoValue(entry.effectiveFrom) },
            formatPercent(entry.grundloen, 2),
          ],
        })),
      });
    } else {
      const visibleColumns = COLUMN_DEFS.filter((column) =>
        column.key !== 'arbejdsdage' &&
        column.key !== 'maaneder' &&
        column.shouldInclude(timeline, af.entries)
      );
      const valueRows = mergeConsecutiveDebugRows(af.entries.map((entry) => ({
        id: `regulation.table:${af.ansaettelsesforholdId}:${entry.effectiveFrom}`,
        cells: visibleColumns.map((column) => column.getCell(entry)),
      })));
      tables.push({
        id: `${sectionId}:vaerdier`,
        columns: visibleColumns.map((column) => resolveVisibleColumnHeader(column, timeline)),
        rows: valueRows,
      });
    }

    if (ansaettelsesforhold && segmentsForDebug.length > 0) {
      const indeksRows = buildReguleringIndexRows({
        segments: segmentsForDebug,
        ansaettelsesforhold,
        anvendtReguleringsdato,
        tafBeregningsenhed: computeTafBeregningsenhed(eoValues),
      });
      if (indeksRows.length > 0) {
        // KL-lønaftaler: trinvis kæde-opregulering vises uden indeksberegning; i stedet
        // ses lønudviklingen og den resulterende, afrundede måneds-/dagsløn.
        // Se docs/domain/taf/kl-loenaftaler-regulering.md.
        const isKlLoenaftalerTable = indeksRows.some((row) => row.reguleretLoen !== undefined);
        const reguleretLoenHeader =
          computeTafBeregningsenhed(eoValues) === 'Måneder' ? 'Reguleret månedsløn' : 'Reguleret dagsløn';
        tables.push(isKlLoenaftalerTable
          ? {
              id: `${sectionId}:beregnet`,
              columns: ['Fra-dato', 'Til-dato', 'Lønudvikling', reguleretLoenHeader],
              rows: indeksRows.map((row, rowIndex) => ({
                id: `${sectionId}:beregnet:${rowIndex}`,
                cells: [row.fraDato, row.tilDato, row.loenudvikling, row.reguleretLoen ?? ''],
              })),
            }
          : {
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

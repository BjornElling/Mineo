/**
 * Regulation View Model - Indeks visning (rettet)
 */

import type { ISODateString } from '../../types/branded';
import type { DebugCellValue } from './eoDebugTypes';
import { formatIsoValue, formatAmountDisplay, formatDecimal, formatPercent } from './eoDebugFormat';
import type { RegulationIndexTimeline } from './eoDebugRegulationTypes';
import { getOverenskomstMetaById } from '../../data/overenskomstRates';

export type RegulationDebugSection = {
  readonly id: string;
  readonly header: string;
  readonly rows: readonly RegulationDebugRow[];
  readonly table?: RegulationDebugTable;
};

export type RegulationDebugRow = {
  readonly id: string;
  readonly label: string;
  readonly value: DebugCellValue | string;
};

export type RegulationDebugTable = {
  readonly columns: readonly string[];
  readonly rows: readonly RegulationDebugTableRow[];
};

export type RegulationDebugTableRow = {
  readonly id: string;
  readonly cells: readonly (DebugCellValue | string)[];
};

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

const buildTableRow = (
  entry: {
    effectiveFrom: ISODateString;
    grundloen: number;
    feriePct: number;
    shSoPct: number;
    fritvalgPct: number;
    storeBededagPct: number;
    pensionPct: number;
    packageValue: number;
    index: number;
    arbejdsdage: number | null;
    maaneder: number | null;
  },
  ansaettelsesforholdId: string
): RegulationDebugTableRow => ({
  id: `regulation.table:${ansaettelsesforholdId}:${entry.effectiveFrom}`,
  cells: [
    { rawValue: entry.effectiveFrom, displayValue: formatIsoValue(entry.effectiveFrom) },
    {
      rawValue: entry.arbejdsdage ?? 0,
      displayValue: entry.arbejdsdage !== null ? entry.arbejdsdage.toString() : '-'
    },
    {
      rawValue: entry.maaneder ?? 0,
      displayValue: entry.maaneder !== null ? formatDecimal(entry.maaneder, 2) : '-'
    },
    buildCurrencyCell(entry.grundloen),
    buildPercentCell(entry.feriePct),
    buildPercentCell(entry.shSoPct),
    buildPercentCell(entry.fritvalgPct),
    buildPercentCell(entry.storeBededagPct),
    buildPercentCell(entry.pensionPct),
    buildCurrencyCell(entry.packageValue),
    buildIndexCell(entry.index),
  ],
});

/**
 * Byg regulation debug sections (indeks) pr. ansaettelsesforhold
 */
export function buildRegulationDebugSections(
  timeline: RegulationIndexTimeline
): readonly RegulationDebugSection[] {
  if (timeline.ansaettelser.length === 0) return [];

  const sections: RegulationDebugSection[] = [];

  timeline.ansaettelser.forEach((af, idx) => {
    const overenskomstMeta = getOverenskomstMetaById(af.overenskomstId);
    const headerSuffix = af.navn ? ` - ${af.navn}` : '';
    const header = `Ansættelsesforhold ${idx + 1}${headerSuffix}`;

    const latest = af.entries[af.entries.length - 1];
    const sectionId = `regulation.${af.ansaettelsesforholdId}`;
    const rows: RegulationDebugRow[] = [
      {
        id: `${sectionId}:overenskomst`,
        label: 'Overenskomst',
        value: overenskomstMeta?.navn ?? af.overenskomstId,
      },
      {
        id: `${sectionId}:skadesdato`,
        label: 'Skadesdato (basis)',
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

    const table: RegulationDebugTable = {
      columns: [
        'Dato',
        'Arbejdsdag',
        'Måneder',
        'Grundløn',
        'Ferie',
        'SH/SO',
        'Fritvalg',
        'Store Bededag',
        'Pension',
        'Pakke',
        'Indeks',
      ],
      rows: af.entries.map((entry) => buildTableRow(entry, af.ansaettelsesforholdId)),
    };

    sections.push({
      id: sectionId,
      header,
      rows,
      table,
    });
  });

  return sections;
}

/**
 * Loen View Model - oversaet loen core til debug-visning
 *
 * - Kun formattering
 * - Ingen beregninger
 */

import type { ISODateString } from '../../types/branded';
import type { CellValue, DebugCellValue } from './eoDebugTypes';
import { formatAmountDisplay, formatIsoValue } from './eoDebugFormat';
import type { LoenTimeline, LoenComponentType } from './eoDebugLoenTypes';

export type DailyLoenRow = {
  readonly iso: ISODateString;
  readonly components: readonly {
    readonly label: string;
    readonly value: CellValue<number>;
  }[];
  readonly dailyTotal: CellValue<number>;
};

export type LoenDebugSection = {
  readonly id: 'loen.daily' | 'loen.summary' | 'svieSmerte.daily' | 'svieSmerte.summary';
  readonly header: string;
  readonly table: LoenDebugTable;
};

export type LoenDebugTable = {
  readonly columns: readonly string[];
  readonly rows: readonly LoenDebugTableRow[];
};

export type LoenDebugTableRow = {
  readonly id: string;
  readonly cells: readonly (DebugCellValue | string)[];
};

const COMPONENT_ORDER: readonly LoenComponentType[] = [
  'grundloen',
  'feriegodtgorelse',
  'fritvalg',
  'shSo',
  'storeBededag',
  'pension',
];

const COMPONENT_LABELS: Readonly<Record<LoenComponentType, string>> = {
  grundloen: 'Grundloen',
  feriegodtgorelse: 'Feriegodtgoerelse',
  fritvalg: 'Fritvalg',
  shSo: 'SH/SO',
  storeBededag: 'Store Bededag',
  pension: 'Pension',
};

const buildCurrencyCell = (value: number): CellValue<number> => ({
  rawValue: value,
  displayValue: formatAmountDisplay(value),
});

const buildLoenRows = (timeline: LoenTimeline): LoenDebugTable => {
  const rows: LoenDebugTableRow[] = timeline.loenDays.map((day) => {
    const perType = new Map<LoenComponentType, number>();
    for (const component of day.components) {
      perType.set(component.type, (perType.get(component.type) ?? 0) + component.amount);
    }

    const cells: (DebugCellValue | string)[] = [
      { rawValue: day.iso, displayValue: formatIsoValue(day.iso) },
    ];

    for (const type of COMPONENT_ORDER) {
      const amount = perType.get(type);
      cells.push(amount !== undefined ? buildCurrencyCell(amount) : '-');
    }

    cells.push(buildCurrencyCell(day.dailyTotal));
    return {
      id: `loen.daily:${day.iso}`,
      cells
    };
  });

  return {
    columns: ['Dato', ...COMPONENT_ORDER.map((t) => COMPONENT_LABELS[t]), 'Daglig total'],
    rows,
  };
};

const buildLoenSummary = (timeline: LoenTimeline): LoenDebugTable => {
  const totals = new Map<LoenComponentType, number>();
  for (const day of timeline.loenDays) {
    for (const component of day.components) {
      totals.set(component.type, (totals.get(component.type) ?? 0) + component.amount);
    }
  }

  const rows: LoenDebugTableRow[] = [];
  for (const type of COMPONENT_ORDER) {
    const total = totals.get(type);
    if (total === undefined) continue;
    rows.push({
      id: `loen.summary:${type}`,
      cells: [COMPONENT_LABELS[type], buildCurrencyCell(total)],
    });
  }

  return {
    columns: ['Komponent', 'Samlet beloeb'],
    rows,
  };
};

const buildSvieSmerteRows = (timeline: LoenTimeline): LoenDebugTable => {
  const rows: LoenDebugTableRow[] = timeline.svieSmerteDays.map((day) => ({
    id: `svieSmerte.daily:${day.iso}`,
    cells: [
      { rawValue: day.iso, displayValue: formatIsoValue(day.iso) },
      day.niveau,
      buildCurrencyCell(day.amount),
    ],
  }));

  return {
    columns: ['Dato', 'Niveau', 'Beloeb pr. dag'],
    rows,
  };
};

const buildSvieSmerteSummary = (timeline: LoenTimeline): LoenDebugTable => {
  const total = timeline.svieSmerteDays.reduce((sum, day) => sum + day.amount, 0);
  return {
    columns: ['Samlet', 'Beloeb'],
    rows: [
      {
        id: 'svieSmerte.summary:total',
        cells: ['Svie/smerte', buildCurrencyCell(total)],
      },
    ],
  };
};

/**
 * Byg loen debug sections (loenpakke + svie/smerte)
 */
export function buildLoenDebugSections(timeline: LoenTimeline): readonly LoenDebugSection[] {
  const sections: LoenDebugSection[] = [];

  if (timeline.loenDays.length > 0) {
    sections.push({
      id: 'loen.daily',
      header: 'Loen pr. dag',
      table: buildLoenRows(timeline),
    });
    sections.push({
      id: 'loen.summary',
      header: 'Loenoversigt',
      table: buildLoenSummary(timeline),
    });
  }

  if (timeline.svieSmerteDays.length > 0) {
    sections.push({
      id: 'svieSmerte.daily',
      header: 'Svie/smerte pr. dag',
      table: buildSvieSmerteRows(timeline),
    });
    sections.push({
      id: 'svieSmerte.summary',
      header: 'Svie/smerte oversigt',
      table: buildSvieSmerteSummary(timeline),
    });
  }

  return sections;
}

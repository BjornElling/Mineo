/**
 * View Model for EODebug tabel
 *
 * FASE 5 SCOPE:
 * - Map DebugDay[] til tabel-rækker og kolonner
 * - getCell interface med { rawValue, displayValue }
 * - Basis-kolonner (dato, weekday, arbejdsdag, TAF, svie/smerte)
 *
 * IKKE i scope:
 * - Løn-kolonner
 * - Regulerings-kolonner
 * - Offentlige ydelser
 */

import type { ISODateString } from '../../types/branded';
import type { DebugDay, DebugCellValue } from '../eoRowEvaluation/eoDebugTypes';
import { formatIsoValue, formatBoolean } from './eoDebugFormat';

/**
 * Kolonne-ID typer
 */
export type BaseColumnId =
  | 'base:weekday'
  | 'base:date'
  | 'base:weekend'
  | 'base:sh_day'
  | 'base:arbejdsdag'
  | 'base:ss_day';

export type TafColumnId = `taf:${string}`;

export type DebugColumnId = BaseColumnId | TafColumnId;

/**
 * Kolonne-definition
 */
export type DebugColumn = Readonly<{
  id: DebugColumnId;
  header: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
}>;

/**
 * View model options
 */
export type DebugViewModelOptions = {
  readonly includeWeekends?: boolean;
  readonly showTafColumns?: boolean;
};

/**
 * Debug tabel view model
 */
export type DebugTabelViewModel = Readonly<{
  rowCount: number;
  getRowKey: (rowIndex: number) => string;
  getRowIso: (rowIndex: number) => ISODateString | undefined;
  columns: readonly DebugColumn[];
  getCell: (rowIndex: number, colId: DebugColumnId) => DebugCellValue;
  tableWidthPx: number;
}>;

const DEFAULT_COLUMN_WIDTH = 120;
const WEEKDAY_WIDTH = 100;
const DATE_WIDTH = 110;
const BOOLEAN_WIDTH = 100;

const weekdayNames: readonly string[] = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
];

/**
 * Byg kolonner baseret på DebugDay[] og options
 */
const buildColumns = (
  debugDays: readonly DebugDay[],
  options: DebugViewModelOptions
): readonly DebugColumn[] => {
  const columns: DebugColumn[] = [];

  // Basis-kolonner (altid inkluderet)
  columns.push({
    id: 'base:weekday',
    header: 'Ugedag',
    align: 'left',
    width: WEEKDAY_WIDTH,
  });

  columns.push({
    id: 'base:date',
    header: 'Dato',
    align: 'left',
    width: DATE_WIDTH,
  });

  columns.push({
    id: 'base:weekend',
    header: 'Weekend',
    align: 'center',
    width: BOOLEAN_WIDTH,
  });

  columns.push({
    id: 'base:sh_day',
    header: 'SH-dag',
    align: 'center',
    width: BOOLEAN_WIDTH,
  });

  columns.push({
    id: 'base:arbejdsdag',
    header: 'Arbejdsdag',
    align: 'center',
    width: BOOLEAN_WIDTH,
    borderLeft: true,
  });

  columns.push({
    id: 'base:ss_day',
    header: 'Svie/smerte',
    align: 'center',
    width: DEFAULT_COLUMN_WIDTH,
    borderLeft: true,
  });

  // TAF-kolonner (hvis enabled og der er TAF-perioder)
  if (options.showTafColumns ?? true) {
    const allTafIds = new Set<string>();

    for (const day of debugDays) {
      for (const tafId of day.tafFlags) {
        allTafIds.add(tafId);
      }
    }

    if (allTafIds.size > 0) {
      // Sortér TAF-IDs for konsistent rækkefølge
      const sortedTafIds = Array.from(allTafIds).sort();

      for (const tafId of sortedTafIds) {
        columns.push({
          id: `taf:${tafId}` as TafColumnId,
          header: `TAF ${tafId}`,
          align: 'center',
          width: BOOLEAN_WIDTH,
          borderLeft: sortedTafIds.indexOf(tafId) === 0, // Border før første TAF
        });
      }
    }
  }

  return columns;
};

/**
 * Filtrér rækker baseret på options
 */
const filterRows = (
  debugDays: readonly DebugDay[],
  options: DebugViewModelOptions
): readonly DebugDay[] => {
  if (options.includeWeekends ?? true) {
    return debugDays;
  }

  return debugDays.filter((day) => !day.isWeekend);
};

/**
 * Byg view model fra DebugDay[]
 *
 * @param debugDays - Array af DebugDay fra core model
 * @param options - View options
 * @returns DebugTabelViewModel
 */
export function buildDebugTabelViewModel(
  debugDays: readonly DebugDay[],
  options: DebugViewModelOptions = {}
): DebugTabelViewModel {
  // Filtrér rækker
  const filteredRows = filterRows(debugDays, options);

  // Byg kolonner
  const columns = buildColumns(debugDays, options);

  // Beregn tabel-bredde
  const tableWidthPx = columns.reduce((sum, col) => sum + col.width, 0);

  // getCell implementation
  const getCell = (
    rowIndex: number,
    colId: DebugColumnId
  ): DebugCellValue => {
    const day = filteredRows[rowIndex];
    if (!day) return '-';

    switch (colId) {
      case 'base:weekday':
        return weekdayNames[day.weekday] ?? '-';

      case 'base:date': {
        const displayValue = formatIsoValue(day.iso);
        return {
          rawValue: day.iso,
          displayValue,
        };
      }

      case 'base:weekend': {
        const displayValue = formatBoolean(day.isWeekend, ['Ja', '-']);
        return {
          rawValue: day.isWeekend,
          displayValue,
        };
      }

      case 'base:sh_day': {
        const displayValue = formatBoolean(day.isSognehelligdag, ['Ja', '-']);
        return {
          rawValue: day.isSognehelligdag,
          displayValue,
        };
      }

      case 'base:arbejdsdag': {
        const displayValue = formatBoolean(day.isArbejdsdag, ['Ja', '-']);
        return {
          rawValue: day.isArbejdsdag,
          displayValue,
        };
      }

      case 'base:ss_day': {
        const displayValue = day.svieSmerte;
        return {
          rawValue: day.svieSmerte,
          displayValue,
        };
      }

      default: {
        // TAF-kolonner
        if (colId.startsWith('taf:')) {
          const tafId = colId.substring(4); // Fjern "taf:" prefix
          const isActive = day.tafFlags.has(tafId);
          const displayValue = formatBoolean(isActive, ['Ja', '-']);
          return {
            rawValue: isActive,
            displayValue,
          };
        }

        return '-';
      }
    }
  };

  return {
    rowCount: filteredRows.length,
    getRowKey: (rowIndex: number) => filteredRows[rowIndex]?.iso ?? '',
    getRowIso: (rowIndex: number) => filteredRows[rowIndex]?.iso,
    columns,
    getCell,
    tableWidthPx,
  };
}

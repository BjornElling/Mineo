import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';

export const getRegulationTableColumns = (table: NonNullable<RegulationDebugSection['tables']>[number]) => {
  const isBeregnetTabel = table.columns.includes('Indeksberegning');
  return table.columns.map((header) => ({
    header,
    align: 'center' as const,
    width: isBeregnetTabel
      ? header === 'Indeksberegning'
        ? '52%'
        : '12%'
      : undefined,
    cellSx: isBeregnetTabel && header === 'Indeksberegning'
      ? { whiteSpace: 'pre-line', verticalAlign: 'top' as const }
      : undefined,
    headerSx: isBeregnetTabel && header === 'Indeksberegning'
      ? { whiteSpace: 'normal' as const }
      : undefined,
  }));
};

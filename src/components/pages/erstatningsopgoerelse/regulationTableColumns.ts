import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';

export const getRegulationTableColumns = (table: NonNullable<RegulationDebugSection['tables']>[number]) => {
  const isBeregnetTabel = table.columns.includes('Indeksberegning');
  const hasArbejdsdageColumn = table.columns.includes('Arbejdsdag') || table.columns.includes('Arbejdsdage');
  const hasMaanederColumn = table.columns.includes('Måned') || table.columns.includes('Måneder');

  const resolveHeaderLabel = (header: string): string => {
    if (header === 'Dato') return 'Fra-dato';
    if (header === 'Arbejdsdag') return 'Arbejdsdage';
    if (header === 'Måned') return 'Måneder';
    if (header === 'Pension') return 'AG pens. bidrag';
    if (header === 'Grundløn' && hasArbejdsdageColumn) return 'Timeløn';
    if (header === 'Grundløn' && hasMaanederColumn) return 'Månedsløn';
    return header;
  };

  return table.columns.map((header) => ({
    header: resolveHeaderLabel(header),
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

import type { RegulationInspektionSection } from '../../../domain/eoInspektion/eoInspektionRegulationViewModel';

// Kolonner der indeholder numeriske værdier og skal højrestilles med indrykning.
// 'Grundløn' og 'Pension' er udeladt: resolveHeaderLabel mapper dem til 'Månedsløn'/'Timeløn'
// og 'AG pens. bidrag' inden dette sæt konsulteres, så de originale navne matcher aldrig.
const NUMERIC_COLUMNS = new Set(['Månedsløn', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'Store Bededag', 'AG pens. bidrag', 'Reguleringsprocent']);
const INDEKS_COLUMNS = new Set(['Indeks', 'Lønudvikling']);

export const getRegulationTableColumns = (table: NonNullable<RegulationInspektionSection['tables']>[number]) => {
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

  return table.columns.map((header) => {
    const resolvedHeader = resolveHeaderLabel(header);
    const isNumeric = !isBeregnetTabel && NUMERIC_COLUMNS.has(resolvedHeader);
    const isIndeks = isBeregnetTabel && INDEKS_COLUMNS.has(resolvedHeader);
    return {
      header: resolvedHeader,
      align: isNumeric || isIndeks ? 'right' as const : 'center' as const,
      width: isBeregnetTabel
        ? header === 'Indeksberegning'
          ? '52%'
          : '12%'
        : undefined,
      cellSx: isBeregnetTabel && header === 'Indeksberegning'
        ? { whiteSpace: 'pre-line', verticalAlign: 'top' as const }
        : undefined,
      cellStyle: isNumeric
        ? { paddingRight: '60px' }
        : isIndeks
          ? { paddingRight: resolvedHeader === 'Indeks' ? '40px' : '30px' }
          : undefined,
      headerSx: isBeregnetTabel && header === 'Indeksberegning'
        ? { whiteSpace: 'normal' as const }
        : isNumeric || isIndeks
          ? { textAlign: 'center' as const }
          : undefined,
    };
  });
};

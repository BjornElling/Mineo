import type { RegulationInspektionSection } from '../../../domain/eoInspektion/eoInspektionRegulationViewModel';
import {
  REGULERINGSVAERDIER_FERIE_HEADER,
  REGULERINGSVAERDIER_PENSION_HEADER,
  REGULERINGSVAERDIER_STORE_BEDEDAG_HEADER,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';

// Kolonner der indeholder numeriske værdier og skal højrestilles med indrykning. Lønkolonnen hedder
// «Timeløn»/«Månedsløn» efter satsens enhed og «Grundløn», når enheden er ukendt («Manuelt angivet»).
// Feriesatsens navn LÆSES fra sin ene kilde: sættet matcher på overskriftsstrengen, så en håndskrevet
// kopi ville miste kolonnens højrejustering, så snart overskriften blev rettet ét af de fire steder.
const NUMERIC_COLUMNS = new Set([
  'Månedsløn', 'Timeløn', 'Grundløn', REGULERINGSVAERDIER_FERIE_HEADER, 'SH/SO', 'Fritvalg',
  REGULERINGSVAERDIER_STORE_BEDEDAG_HEADER, REGULERINGSVAERDIER_PENSION_HEADER, 'Reguleringsprocent',
]);
const INDEKS_COLUMNS = new Set(['Indeks', 'Lønudvikling']);

export const getRegulationTableColumns = (table: NonNullable<RegulationInspektionSection['tables']>[number]) => {
  const isBeregnetTabel = table.columns.includes('Indeksberegning');

  // Kun «Dato» omdøbes. Overskrifterne kommer fra samme præsentation som dokumentet; en omdøbning af
  // «Grundløn» til «Timeløn»/«Månedsløn» ville påstå en enhed, programmet ikke kender (BB-309).
  const resolveHeaderLabel = (header: string): string => (header === 'Dato' ? 'Fra-dato' : header);

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

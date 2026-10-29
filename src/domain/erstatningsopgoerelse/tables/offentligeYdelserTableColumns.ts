import type { OffentligeYdelserTableColumnKey } from '../../../types/table';

// Normativt: `ydelse` og `tillaeg` er to visuelt adskilte ydelsesfelter med identisk domænebetydning – præcis som
// lønindkomstens «Løn» og «Løn (2)». De må kun adskilles i præsentationen; beregningsmæssigt summeres de blot.
// Navnene er forskellige med vilje: en udbetaling af en social ydelse rummer typisk én ydelse og nogle få tilknyttede
// tillæg (fx ATP), mens en lønseddel har mange ligestillede lønposter (udviklerafgørelse 2026-10-29, BB-361). Skærm,
// «Fejl og advarsler» og bilaget bruger derfor de samme to navne.
export const OFFENTLIGE_YDELSER_COL_YDELSE_LABEL = 'Ydelse';
export const OFFENTLIGE_YDELSER_COL_TILLAEG_LABEL = 'Tillæg';

export const OFFENTLIGE_YDELSER_TABLE_HEADERS = [
  'Fra dato',
  'Til dato',
  OFFENTLIGE_YDELSER_COL_YDELSE_LABEL,
  OFFENTLIGE_YDELSER_COL_TILLAEG_LABEL,
  'Ydelsestype',
  'Periodisering',
  'Antal dage',
  'Ydelse per dag',
] as const;

export const OFFENTLIGE_YDELSER_PDF_HEADERS = [
  'Fra-dato',
  'Til-dato',
  OFFENTLIGE_YDELSER_COL_YDELSE_LABEL,
  OFFENTLIGE_YDELSER_COL_TILLAEG_LABEL,
  'I alt',
] as const;

export const resolveOffentligeYdelserColumnLabel = (colKey: OffentligeYdelserTableColumnKey): string => {
  switch (colKey) {
    case 'fraDato':
      return OFFENTLIGE_YDELSER_TABLE_HEADERS[0];
    case 'tilDato':
      return OFFENTLIGE_YDELSER_TABLE_HEADERS[1];
    case 'ydelse':
      return OFFENTLIGE_YDELSER_COL_YDELSE_LABEL;
    case 'tillaeg':
      return OFFENTLIGE_YDELSER_COL_TILLAEG_LABEL;
    case 'ydelsestype':
      return 'Ydelsestype';
    default: {
      const _exhaustive: never = colKey;
      void _exhaustive;
      return 'felt';
    }
  }
};

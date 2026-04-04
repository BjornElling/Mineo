import * as React from 'react';
import type { OffentligeYdelserTableColumnKey } from '../../../types/table';
import InfoTooltipIcon from '../../../components/common/InfoTooltipIcon';

// Normativt: `ydelse` og `tillaeg` er to visuelt adskilte ydelsesfelter med identisk domænebetydning.
// De må kun adskilles i præsentationen; beregningsmæssigt summeres de blot.
export const OFFENTLIGE_YDELSER_COL_YDELSE_LABEL = 'Ydelse';
export const OFFENTLIGE_YDELSER_COL_YDELSE_2_LABEL = 'Ydelse (2)';

export const OFFENTLIGE_YDELSER_TABLE_HEADERS = [
  'Fra-dato',
  'Til-dato',
  OFFENTLIGE_YDELSER_COL_YDELSE_LABEL,
  OFFENTLIGE_YDELSER_COL_YDELSE_2_LABEL,
  'Ydelsestype',
  'Periodisering',
  'Antal dage',
  'Ydelse / dag',
] as const;

const YDELSE_2_TOOLTIP_TEXT = 'Opdelingen af ydelser er rent visuel - værdierne lægges sammen i beregningen';

export const getOffentligeYdelserTableHeaderNodes = (): readonly React.ReactNode[] => {
  return OFFENTLIGE_YDELSER_TABLE_HEADERS.map((header) => {
    if (header !== OFFENTLIGE_YDELSER_COL_YDELSE_2_LABEL) return header;
    return React.createElement(
      'span',
      undefined,
      header,
      React.createElement(InfoTooltipIcon, { title: YDELSE_2_TOOLTIP_TEXT })
    );
  });
};

export const OFFENTLIGE_YDELSER_PDF_HEADERS = [
  'Fra-dato',
  'Til-dato',
  OFFENTLIGE_YDELSER_COL_YDELSE_LABEL,
  OFFENTLIGE_YDELSER_COL_YDELSE_2_LABEL,
  'I alt',
] as const;

export const resolveOffentligeYdelserColumnLabel = (colKey: OffentligeYdelserTableColumnKey): string => {
  switch (colKey) {
    case 'fraDato':
      return 'Fra dato';
    case 'tilDato':
      return 'Til dato';
    case 'ydelse':
      return OFFENTLIGE_YDELSER_COL_YDELSE_LABEL;
    case 'tillaeg':
      return OFFENTLIGE_YDELSER_COL_YDELSE_2_LABEL;
    case 'ydelsestype':
      return 'Ydelsestype';
    default: {
      const _exhaustive: never = colKey;
      void _exhaustive;
      return 'felt';
    }
  }
};

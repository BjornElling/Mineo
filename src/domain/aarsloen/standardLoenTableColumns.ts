import * as React from 'react';
import type { Loenperiode } from '../../schemas/formSchemas';
import type { StandardLoenTableColumnKey } from '../../types/table';
import InfoTooltipIcon from '../../components/common/InfoTooltipIcon';

// Normativt: col2 og col3 er to visuelt adskilte lønfelter med identisk domænebetydning.
// De må kun adskilles i præsentationen; beregningsmæssigt summeres de blot.
export const STANDARD_LOEN_COL2_LABEL = 'Løn';
export const STANDARD_LOEN_COL3_LABEL = 'Løn (2)';
export const STANDARD_LOEN_COL4_LABEL = 'Ikke-pensions-\ngivende løn';
export const STANDARD_LOEN_COL5_LABEL = 'ATP og anden\nløn u. tillæg';
export const STANDARD_LOEN_FPFVSHSO_LABEL = 'FP/FV/SH/\nSO/St.B.';
export const STANDARD_LOEN_PENSION_LABEL = 'Arb.g.\nPension';
export const STANDARD_LOEN_SAMLET_LABEL = 'Samlet løn';

const PERIOD_HEADERS: Record<Loenperiode, readonly [string, string]> = {
  maaned: ['Måned', 'År'],
  uge: ['Uge fra', 'Uge til'],
  dag: ['Dato fra', 'Dato til'],
};

const stripHeaderLineBreaks = (label: string): string => label.replace(/\n/g, '');

export const resolveStandardLoenColumnLabel = (colKey: StandardLoenTableColumnKey): string => {
  switch (colKey) {
    case 'col0_maaned':
      return 'Måned';
    case 'col1_maaned':
      return 'År';
    case 'col0_uge':
      return 'Uge fra';
    case 'col1_uge':
      return 'Uge til';
    case 'col0_dag':
      return 'Dato fra';
    case 'col1_dag':
      return 'Dato til';
    case 'col2':
      return STANDARD_LOEN_COL2_LABEL;
    case 'col3':
      return STANDARD_LOEN_COL3_LABEL;
    case 'col4':
      return stripHeaderLineBreaks(STANDARD_LOEN_COL4_LABEL);
    case 'col5':
      return stripHeaderLineBreaks(STANDARD_LOEN_COL5_LABEL);
    case 'fpFvShSoBeloeb':
      return stripHeaderLineBreaks(STANDARD_LOEN_FPFVSHSO_LABEL);
    case 'pensionBeloeb':
      return stripHeaderLineBreaks(STANDARD_LOEN_PENSION_LABEL);
    default: {
      const _exhaustive: never = colKey;
      void _exhaustive;
      return 'felt';
    }
  }
};

export const getStandardLoenTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  return [
    ...PERIOD_HEADERS[loenperiode],
    STANDARD_LOEN_COL2_LABEL,
    STANDARD_LOEN_COL3_LABEL,
    STANDARD_LOEN_COL4_LABEL,
    STANDARD_LOEN_COL5_LABEL,
    STANDARD_LOEN_FPFVSHSO_LABEL,
    STANDARD_LOEN_PENSION_LABEL,
    STANDARD_LOEN_SAMLET_LABEL,
  ];
};

/**
 * Returnerer indekset for en given label i arrayet fra getStandardLoenTableHeaders.
 * Fejler hårdt (invariant) hvis labelen ikke findes — det indikerer et array-strukturbrud.
 *
 * Bruges i stedet for hardkodede integer-konstanter, der tavst ville give forkerte
 * kolonne-lookup ved fremtidige array-ændringer.
 */
export const getStandardLoenHeaderIndex = (loenperiode: Loenperiode, label: string): number => {
  const headers = getStandardLoenTableHeaders(loenperiode);
  const index = headers.indexOf(label);
  if (index === -1) {
    throw new Error(`CRITICAL: Kolonneoverskrift "${label}" ikke fundet i standardLoenTableHeaders.`);
  }
  return index;
};

const LOEN_2_TOOLTIP_TEXT = 'Opdelingen af løn er rent visuel - værdierne lægges sammen i beregningen';

export const getStandardLoenTableHeaderNodes = (loenperiode: Loenperiode): readonly React.ReactNode[] => {
  return getStandardLoenTableHeaders(loenperiode).map((header) => {
    if (header !== STANDARD_LOEN_COL3_LABEL) return header;
    return React.createElement(
      'span',
      undefined,
      header,
      React.createElement(InfoTooltipIcon, { title: LOEN_2_TOOLTIP_TEXT })
    );
  });
};

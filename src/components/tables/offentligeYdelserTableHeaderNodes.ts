import * as React from 'react';
import InfoTooltipIcon from '../common/InfoTooltipIcon';
import {
  OFFENTLIGE_YDELSER_COL_TILLAEG_LABEL,
  OFFENTLIGE_YDELSER_TABLE_HEADERS,
} from '../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';

// Overskrifternes React-form bor her og ikke i domænemodulet med kolonnenavnene: navnene læses også af
// dokumenterne og «Fejl og advarsler», som ikke må trække en UI-komponent med sig (samme deling som
// `standardLoenTableHeaderNodes.ts`).

// Samme forklaring som «Løn (2)» på lønindkomsten (BB-361); tankestregen er en-dash med mellemrum omkring.
const TILLAEG_TOOLTIP_TEXT = 'Opdelingen af ydelser er rent visuel – værdierne lægges sammen i beregningen';

export const getOffentligeYdelserTableHeaderNodes = (): readonly React.ReactNode[] =>
  OFFENTLIGE_YDELSER_TABLE_HEADERS.map((header) => {
    if (header !== OFFENTLIGE_YDELSER_COL_TILLAEG_LABEL) return header;
    return React.createElement(
      'span',
      undefined,
      header,
      React.createElement(InfoTooltipIcon, { title: TILLAEG_TOOLTIP_TEXT })
    );
  });

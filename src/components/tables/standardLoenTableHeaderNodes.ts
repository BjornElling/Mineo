import * as React from 'react';
import type { Loenperiode } from '../../schemas/formSchemas';
import InfoTooltipIcon from '../common/InfoTooltipIcon';
import { getStandardLoenTableHeaders, STANDARD_LOEN_COL3_LABEL } from '../../domain/aarsloen/standardLoenTableColumns';

// Overskrifternes React-form bor her og ikke i domænemodulet med kolonnenavnene: navnene læses også af
// dokumenterne og kontroltabellen, som ikke må trække en UI-komponent med sig.

// Tankestregen er en-dash med mellemrum omkring (beslutning 2026-08-19), ikke en bindestreg.
const LOEN_2_TOOLTIP_TEXT = 'Opdelingen af løn er rent visuel – værdierne lægges sammen i beregningen';

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

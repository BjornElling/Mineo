/**
 * Delte render-hjælpere til EO-kontrol-rækkekomponenter.
 *
 * Samler de byggesten der ellers var dupliceret verbatim på tværs af
 * EOInspektionRowsSection, EOInspektionGroupedRowsSection og EOInspektionEmploymentSections:
 * - statusikon pr. `EoRowStatus`
 * - `sx` til displayværdi (højrejustering ved flerlinjet indhold)
 * - fælles label-bredde for label/værdi-rækker
 */

import * as React from 'react';
import { Box } from '@mui/material';
import { Check, ErrorOutlined as ErrorOutline, WarningAmber } from '@mui/icons-material';
import type { EoRowStatus } from '../../../domain/eoRowEvaluation/eoRowTypes';

/** Fælles label-bredde for kontrol-label/værdi-rækker. */
export const INSPEKTION_ROW_LABEL_WIDTH = '320px';

/**
 * Smallere label-bredde for regulerings-rækker. Bevidst afvigelse fra
 * `INSPEKTION_ROW_LABEL_WIDTH`: regulerings-labels er kortere, så en smallere
 * kolonne giver et tættere layout. Centraliseret her, fordi den ellers var
 * defineret to steder (EOInspektionRegulationSections + regulerings-grenen i
 * EOInspektionEmploymentSections) og kunne drifte.
 */
export const INSPEKTION_REGULATION_ROW_LABEL_WIDTH = '250px';

/**
 * Statusikon for en kontrol-række ud fra dens max-severity.
 *
 * En `ok`-række, hvis værdi er `-`, har intet at kontrollere og får intet mærke – et grønt ✓ ved siden af «-»
 * påstod, at noget var kontrolleret og i orden (samme princip som sammentællingen, BB-386). Pladsen bevares,
 * så værdierne i kolonnen står lige.
 */
export const getStatusIcon = (status: EoRowStatus, displayValue?: string): React.ReactElement => {
  if (status === 'ok' && displayValue?.trim() === '-') {
    return <Box component="span" aria-hidden sx={{ width: 20, height: 20, flexShrink: 0 }} />;
  }
  switch (status) {
    case 'error':
      return <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />;
    case 'warning':
      return <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />;
    case 'ok':
      return <Check sx={{ color: 'var(--color-status-success)', fontSize: 20 }} />;
  }
};

/** `sx` til displayværdi: bevar linjeskift og højrejustér ved flerlinjet indhold. */
export const getDisplayValueSx = (displayValue: string) => ({
  whiteSpace: 'pre-line' as const,
  textAlign: displayValue.includes('\n') ? 'right' as const : 'inherit',
});

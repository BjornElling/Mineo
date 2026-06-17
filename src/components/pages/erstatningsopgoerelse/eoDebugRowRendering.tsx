/**
 * Delte render-hjælpere til EO-debug-rækkekomponenter.
 *
 * Samler de byggesten der ellers var dupликeret verbatim på tværs af
 * EODebugRowsSection, EODebugGroupedRowsSection og EODebugEmploymentSections:
 * - statusikon pr. `DebugStatus`
 * - `sx` til displayværdi (højrejustering ved flerlinjet indhold)
 * - fælles label-bredde for label/værdi-rækker
 */

import * as React from 'react';
import { Check, ErrorOutlined as ErrorOutline, WarningAmber } from '@mui/icons-material';
import type { DebugStatus } from '../../../domain/debug/eoDebugTypes';

/** Fælles label-bredde for debug-label/værdi-rækker. */
export const DEBUG_ROW_LABEL_WIDTH = '320px';

/** Statusikon for en debug-række ud fra dens max-severity. */
export const getStatusIcon = (status: DebugStatus): React.ReactElement => {
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

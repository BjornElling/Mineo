import React from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorOutlined as ErrorOutline, WarningAmber } from '@mui/icons-material';

import ContentBox from '../../layout/ContentBox';
import { scrollToFieldAddress } from '../../../utils/scrollToFieldAddress';
import type { AarsloenIssueRow, AarsloenIssueTarget } from '../../../domain/aarsloen/aarsloenIssueRows';
import { useAarsloenVm } from './aarsloenContext';

const ROW_SX = {
  '--label-width': '400px',
  display: 'grid',
  gridTemplateColumns: '1fr max-content',
  alignItems: 'flex-start',
  gap: 1,
  '& > :first-of-type': { minWidth: 0, overflowWrap: 'break-word' },
  '& .row--label-right-hover__content': {
    minWidth: 'max-content',
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-start',
  },
} as const;

const LINK_SX = {
  cursor: 'pointer',
  border: 0,
  background: 'transparent',
  p: 0,
  m: 0,
  font: 'inherit',
} as const;

/**
 * «Fejl og advarsler» – magen til de øvrige siders boks (BB-350, udviklerafgørelse 2026-10-27).
 *
 * ALLE blokerende fejl og mangler står her: feltfejl, manglende overenskomstforudsætninger, lønrækkernes
 * cellefejl, en kritisk beregningsfejl og et afbrudt dokument. Ved felterne er der kun rød ring og tooltip. Boksen
 * RENDERER kun – rækkerne formuleres i `buildAarsloenIssueRows`. Linket fører til feltet eller lønrækkens celle.
 */
export const AarsloenFejlOgAdvarslerSection = React.memo(() => {
  const { issueRows, tabelRef } = useAarsloenVm();

  const goTo = React.useCallback((target: AarsloenIssueTarget) => {
    if (target.kind === 'field') scrollToFieldAddress(target.address);
    else tabelRef.current?.flashError(target.error);
  }, [tabelRef]);

  if (issueRows.length === 0) return null;

  const renderRow = (row: AarsloenIssueRow) => (
    <Box key={row.id} className="row--label-right-hover" sx={ROW_SX}>
      <Typography className="row--text">{row.message}</Typography>
      <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
        {row.target !== undefined && (
          <Typography
            className="row--text icon-text-link"
            component="button"
            type="button"
            onClick={() => { if (row.target !== undefined) goTo(row.target); }}
            sx={LINK_SX}
          >
            {row.target.sectionName}
          </Typography>
        )}
        {row.severity === 'error'
          ? <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
          : <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />}
      </Box>
    </Box>
  );

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Fejl og advarsler</Typography>
      {issueRows.map(renderRow)}
    </ContentBox>
  );
});

AarsloenFejlOgAdvarslerSection.displayName = 'AarsloenFejlOgAdvarslerSection';

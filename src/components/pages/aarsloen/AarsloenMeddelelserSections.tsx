import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Årsløns meddelelsesbokse. Hver vises kun, når den har indhold.
 *
 * De er BEVIDST tre selvstændige komponenter frem for én: rækkefølgen på siden er ikke sammenhængende. Den
 * kritiske fejl står ØVERST (før Satser), mens advarsler og dokument-fejl står mellem Beregningsprincipper og
 * Beregning. En samlet komponent kunne ikke gengive den placering uden at flytte noget synligt.
 */

export const AarsloenKritiskFejlSection = React.memo(() => {
  const { beregningsFejl } = useAarsloenVm();
  if (!beregningsFejl) return null;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Kritisk Fejl</Typography>
      <Typography className="row--text" sx={{ color: 'error.main' }}>
        {beregningsFejl}
      </Typography>
    </ContentBox>
  );
});

AarsloenKritiskFejlSection.displayName = 'AarsloenKritiskFejlSection';

export const AarsloenAdvarslerSection = React.memo(() => {
  const { fejlmeddelelser, shouldWarnFeriePct, values } = useAarsloenVm();
  if (fejlmeddelelser.length === 0 && !shouldWarnFeriePct) return null;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Advarsler</Typography>

      {fejlmeddelelser.map((fejl, index) => (
        <Box key={index} className="row--label-right-hover">
          <Typography className="row--text">{fejl}</Typography>
          <Box />
        </Box>
      ))}

      {shouldWarnFeriePct && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">
            {`En feriegodtgørelsessats på ${values.feriePct} % skaber en klar formodning for, at der er ret til 6. ferieuge.`}
          </Typography>
          <Box />
        </Box>
      )}
    </ContentBox>
  );
});

AarsloenAdvarslerSection.displayName = 'AarsloenAdvarslerSection';

export const AarsloenDokumentFejlSection = React.memo(() => {
  const { downloadErrorMessage } = useAarsloenVm();
  if (!downloadErrorMessage) return null;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Dokument-fejl</Typography>
      <Typography className="row--text" sx={{ color: 'error.main' }}>
        {downloadErrorMessage}
      </Typography>
    </ContentBox>
  );
});

AarsloenDokumentFejlSection.displayName = 'AarsloenDokumentFejlSection';

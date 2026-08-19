import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import { PageMessageBox } from '../../layout/PageMessageBox';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Årsløns meddelelsesbokse. Hver vises kun, når den har indhold.
 *
 * De er BEVIDST tre selvstændige komponenter frem for én: rækkefølgen på siden er ikke sammenhængende. Den
 * kritiske fejl står ØVERST (før Satser), mens advarsler og dokument-fejl står mellem Beregningsprincipper og
 * Beregning. En samlet komponent kunne ikke gengive den placering uden at flytte noget synligt.
 *
 * De to fejlbokse ejer IKKE deres eget synlighedsværn – det ligger i `PageMessageBox`. Den kritiske boks stod
 * tidligere permanent og tom øverst på siden, fordi den håndrullede værnet (`if (!beregningsFejl)`) på en værdi,
 * hvor truthiness ikke betød "har indhold"; se `components/layout/pageMessage.ts`.
 */

export const AarsloenKritiskFejlSection = React.memo(() => {
  const { beregningsFejl } = useAarsloenVm();
  return <PageMessageBox title="Kritisk Fejl" message={beregningsFejl} />;
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
  return <PageMessageBox title="Dokument-fejl" message={downloadErrorMessage} />;
});

AarsloenDokumentFejlSection.displayName = 'AarsloenDokumentFejlSection';

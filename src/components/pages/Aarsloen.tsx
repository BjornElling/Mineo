import React from 'react';
import { Box, Typography } from '@mui/material';

import { AarsloenVmProvider } from './aarsloen/aarsloenContext';
import { useAarsloenViewModel } from './aarsloen/useAarsloenViewModel';
import AarsloenSatserSection from './aarsloen/AarsloenSatserSection';
import AarsloenIndtaegtSection from './aarsloen/AarsloenIndtaegtSection';
import AarsloenBeregningsprincipperSection from './aarsloen/AarsloenBeregningsprincipperSection';
import AarsloenBeregningSection from './aarsloen/AarsloenBeregningSection';
import {
  AarsloenAdvarslerSection,
  AarsloenDokumentFejlSection,
  AarsloenKritiskFejlSection,
} from './aarsloen/AarsloenMeddelelserSections';

/**
 * Årslønsberegning: beregner årsløn ud fra satser og indtægtsoplysninger.
 *
 * Siden er sektions-komposition (`page-component-contract.md` §4.4): reader-projektionen, omregning-gaten,
 * beregningsresultatet og de to dokumenthandles bor i `useAarsloenViewModel`.
 */
const Aarsloen = React.memo(() => {
  const vm = useAarsloenViewModel();

  return (
    <AarsloenVmProvider value={vm}>
      <Box>
        <Typography className="page-title">Årslønsberegning</Typography>

        <AarsloenKritiskFejlSection />
        <AarsloenSatserSection />
        <AarsloenIndtaegtSection />
        <AarsloenBeregningsprincipperSection />
        <AarsloenAdvarslerSection />
        <AarsloenDokumentFejlSection />
        <AarsloenBeregningSection />
      </Box>
    </AarsloenVmProvider>
  );
});

Aarsloen.displayName = 'Aarsloen';

export default Aarsloen;

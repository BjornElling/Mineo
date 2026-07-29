import React from 'react';
import { Box, Typography } from '@mui/material';

import { ForsoergertabVmProvider } from './forsoergertab/forsoergertabContext';
import { useForsoergertabViewModel } from './forsoergertab/useForsoergertabViewModel';
import ForsoergertabBeregningSection from './forsoergertab/ForsoergertabBeregningSection';
import ForsoergertabOplysningerSection from './forsoergertab/ForsoergertabOplysningerSection';
import ForsoergertabResultatSection from './forsoergertab/ForsoergertabResultatSection';
import ForsoergertabEalSection from './forsoergertab/ForsoergertabEalSection';
import ForsoergertabAslSection from './forsoergertab/ForsoergertabAslSection';

/**
 * Forsørgertab.
 *
 * Siden er sektions-komposition (`page-component-contract.md` §4.4): den ene reader-afledte projektion,
 * feltbindingerne og dokumenthandlet bor i `useForsoergertabViewModel`. Hvert resultatpanel gater sig selv på
 * sine egne dependencies (§1.10), så en fejl på ét felt ikke skjuler de paneler, den ikke påvirker.
 */
const Forsoergertab = React.memo(() => {
  const vm = useForsoergertabViewModel();

  return (
    <ForsoergertabVmProvider value={vm}>
      <Box>
        <Typography className="page-title">Forsørgertab</Typography>

        <ForsoergertabBeregningSection />
        <ForsoergertabOplysningerSection />
        <ForsoergertabResultatSection />
        <ForsoergertabEalSection />
        <ForsoergertabAslSection />
      </Box>
    </ForsoergertabVmProvider>
  );
});

Forsoergertab.displayName = 'Forsoergertab';

export default Forsoergertab;

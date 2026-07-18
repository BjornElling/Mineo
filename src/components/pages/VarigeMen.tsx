import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import MenberegningTab from './varigemen/MenberegningTab';
import SatserTab from './varigemen/SatserTab';

// Greenfield-migreret (§2.4 formularrækkefølge trin 5 / Fase 3 Varige mén-slice). Siden ejer ingen input-state
// længere: `MenberegningTab` læser/skriver selv gennem greenfield-inputCore. Ingen `usePersistedForm`- eller
// `usePersistedSectionSelector`-legacy-sink.

const TAB_KEYS = {
  MENBEREGNING: 'menberegning',
  SATSER: 'satser',
} as const;

type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

const VarigeMen = React.memo(() => {
  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
    pageId: 'varigemen',
    allowedTabs: [TAB_KEYS.MENBEREGNING, TAB_KEYS.SATSER],
    defaultTab: TAB_KEYS.MENBEREGNING,
  });

  return (
    <Box>
      <Typography className="page-title">Varige mén</Typography>

      <PageTabs
        items={[
          { key: TAB_KEYS.MENBEREGNING, label: 'Ménberegning' },
          { key: TAB_KEYS.SATSER, label: 'Satser' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === TAB_KEYS.SATSER ? (
        <SatserTab />
      ) : (
        <MenberegningTab />
      )}
    </Box>
  );
});

VarigeMen.displayName = 'VarigeMen';

export default VarigeMen;

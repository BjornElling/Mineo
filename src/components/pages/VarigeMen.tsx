import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { varigeMenSchema } from '../../schemas/formSchemas';
import MenberegningTab from './varigemen/MenberegningTab';
import SatserTab from './varigemen/SatserTab';

const TAB_KEYS = {
  MENBEREGNING: 'menberegning',
  SATSER: 'satser',
} as const;

type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

const VarigeMen = React.memo(() => {
  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<TabKey>({
    pageId: 'varigemen',
    allowedTabs: [TAB_KEYS.MENBEREGNING, TAB_KEYS.SATSER],
    defaultTab: TAB_KEYS.MENBEREGNING,
    legacySource: { persistedPageKey: 'varigemen', fieldName: 'activeTab' },
  });

  const { values, setValues, handleChange } = usePersistedForm(varigeMenSchema, 'varigemen', {
    fodselsdato: undefined,
    mengrad: undefined,
    beregningsdato: undefined,
  });

  const handleTabChange = React.useCallback(
    (_: React.SyntheticEvent, value: unknown) => {
      if (!isAllowedTab(value)) return;
      setActiveTab(value);
    },
    [isAllowedTab, setActiveTab]
  );

  return (
    <Box>
      <Typography className="page-title">Varige mén</Typography>

      <Box
        sx={{
          position: 'relative',
          width: '1200px',
          height: 0,
          mb: '40px',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-48px',
            right: '20px',
            zIndex: 10,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minWidth: 140,
                transition: 'color 0.2s, opacity 0.2s',
                opacity: 0.7,
                '&:hover': { opacity: 1 },
                '&.Mui-selected': {
                  color: 'primary.main',
                  opacity: 1,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
                height: '2px',
              },
            }}
          >
            <Tab label="Ménberegning" value={TAB_KEYS.MENBEREGNING} sx={{ textTransform: 'none' }} />
            <Tab label="Satser" value={TAB_KEYS.SATSER} sx={{ textTransform: 'none' }} />
          </Tabs>
        </Box>
      </Box>

      {activeTab === TAB_KEYS.SATSER ? (
        <SatserTab />
      ) : (
        <MenberegningTab values={values} setValues={setValues} handleChange={handleChange} />
      )}
    </Box>
  );
});

VarigeMen.displayName = 'VarigeMen';

export default VarigeMen;


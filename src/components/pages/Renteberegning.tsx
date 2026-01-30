import React from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { renteberegningSchema } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import useRentekravRows from '../tables/useRentekravRows';
import { createEmptyRentekravCommittedRow, createRentekravRowId } from '../../domain/renteberegning/rentekravTableModel';
import BeregningTab from './renteberegning/BeregningTab';
import RentesatserTab from './renteberegning/RentesatserTab';

/**
 * Tab-nøgler for navigation mellem Rentesatser og Beregning
 */
type TabKey = 'rates' | 'calculation';

const TAB_KEYS = {
  RATES: 'rates',
  CALCULATION: 'calculation',
} as const;

const Renteberegning = React.memo(() => {
  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<TabKey>({
    pageId: 'renteberegning',
    allowedTabs: [TAB_KEYS.RATES, TAB_KEYS.CALCULATION],
    defaultTab: TAB_KEYS.CALCULATION,
    legacySource: { persistedPageKey: 'renteberegning', fieldName: 'activeTab' },
  });

  const { values, setValues, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    {
      beregningsdato: undefined,
      rentekravRows: [createEmptyRentekravCommittedRow(createRentekravRowId())],
    }
  );

  const handleError = React.useCallback((message: string, context: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}] ${message}`, error);
    }
  }, []);

  const rentekrav = useRentekravRows({ values, setValues, resyncToken: formVersion });

  const handleBeregningsdatoChange = React.useCallback(
    (event: { target: { value: unknown } }) => {
      const value = event?.target?.value as ISODateString | undefined;
      setValues((prev) => ({ ...prev, beregningsdato: value }));
    },
    [setValues]
  );

  const handleTabChange = React.useCallback(
    (_: React.SyntheticEvent, value: unknown) => {
      if (!isAllowedTab(value)) return;
      setActiveTab(value);
    },
    [isAllowedTab, setActiveTab]
  );

  return (
    <Box>
      <Typography className="page-title">Renteberegning</Typography>

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
                '&:hover': {
                  opacity: 1,
                },
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
            <Tab label="Beregning" value={TAB_KEYS.CALCULATION} />
            <Tab label="Rentesatser" value={TAB_KEYS.RATES} />
          </Tabs>
        </Box>
      </Box>

      {activeTab === TAB_KEYS.RATES ? (
        <RentesatserTab />
      ) : (
        <BeregningTab
          beregningsdato={values.beregningsdato}
          onBeregningsdatoChange={handleBeregningsdatoChange}
          rentekravRows={rentekrav.draftRows}
          onRentekravChange={rentekrav.onFieldChange}
          onRentekravBlur={rentekrav.onFieldBlur}
          committedRentekravById={rentekrav.committedById}
          onError={handleError}
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;

import React from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { referenceRates, surchargeRates } from '../../data/interestRates';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { renteberegningSchema } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import useRentekravRows from '../tables/useRentekravRows';
import { createEmptyRentekravCommittedRow, createRentekravRowId } from '../../domain/renteberegning/rentekravTableModel';
import type { RentePdfContext } from '../tables/BeregnetRenteTable';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { useAppSettings } from '../../contexts/useAppSettings';
import { downloadRentePdf } from '../../utils/pdf/pdfService';
import type { CommitHandler } from '../../types/fieldEvents';
import RenteberegningTab from './renteberegning/RenteberegningTab';
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
  const { getPersistedData } = useFormPersistence();
  const { settings } = useAppSettings();
  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<TabKey>({
    pageId: 'renteberegning',
    allowedTabs: [TAB_KEYS.RATES, TAB_KEYS.CALCULATION],
    defaultTab: TAB_KEYS.CALCULATION,
  });

  const { values, setValues, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    {
      beregningsdato: undefined,
      kommentarer: undefined,
      rentekravRows: [createEmptyRentekravCommittedRow(createRentekravRowId())],
    }
  );

  const handleError = React.useCallback((message: string, context: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}] ${message}`, error);
    }
  }, []);

  const rentekrav = useRentekravRows({ values, setValues, resyncToken: formVersion });

  const handleBeregningsdatoCommit = React.useCallback<CommitHandler<ISODateString | undefined>>(
    (event) => {
      setValues((prev) => ({ ...prev, beregningsdato: event.target.value }));
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

  const handleKommentarerChange = React.useCallback<CommitHandler<string>>(
    (event) => {
      const normalized = event.target.value.trim();
      setValues((prev) => ({ ...prev, kommentarer: normalized === '' ? undefined : normalized }));
    },
    [setValues]
  );

  const handleDownloadRentePdf = React.useCallback(
    async (pdfContext: RentePdfContext) => {
      const actualInterestDateDanish = isoToDanish(pdfContext.actualInterestDate);
      const beregningsdatoDanish = isoToDanish(pdfContext.beregningsdato);
      if (!actualInterestDateDanish || !beregningsdatoDanish) {
        handleError('Ugyldige datoer for PDF-generering', 'Renteberegning.PDFGeneration');
        return;
      }
      const result = await downloadRentePdf({
        beloeb: pdfContext.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        kommentarer: values.kommentarer,
        settings,
        persistedStamdata: getPersistedData('stamdata'),
      });
      if (!result.success) {
        handleError(result.error, 'Renteberegning.PDFGeneration');
      }
    },
    [getPersistedData, handleError, settings, values.kommentarer]
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
        <RenteberegningTab
          beregningsdato={values.beregningsdato}
          kommentarer={values.kommentarer}
          onKommentarerCommit={handleKommentarerChange}
          onBeregningsdatoCommit={handleBeregningsdatoCommit}
          rentekravRows={rentekrav.draftRows}
          onRentekravChange={rentekrav.onFieldChange}
          onRentekravBlur={rentekrav.onFieldBlur}
          onDownloadSpecifikation={handleDownloadRentePdf}
          committedRentekravById={rentekrav.committedById}
          onError={handleError}
          referenceRates={referenceRates}
          surchargeRates={surchargeRates}
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;

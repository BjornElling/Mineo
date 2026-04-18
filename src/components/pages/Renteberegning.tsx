import React from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { referenceRates, surchargeRates } from '../../data/interestRates';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedSectionSelector } from '../../hooks/useFormPersistenceSelectors';
import { renteberegningSchema } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import useRentekravRows from '../tables/useRentekravRows';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
import type { RentePdfContext } from '../tables/BeregnetRenteTable';
import { useAppSettings } from '../../contexts/useAppSettings';
import { downloadRentePdf } from '../../pdf/infrastructure/pdfService';
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
  const persistedStamdata = usePersistedSectionSelector('stamdata');
  const { settings } = useAppSettings();
  const initialValues = React.useMemo(() => createRenteberegningInitialValues(), []);
  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<TabKey>({
    pageId: 'renteberegning',
    allowedTabs: [TAB_KEYS.RATES, TAB_KEYS.CALCULATION],
    defaultTab: TAB_KEYS.CALCULATION,
  });

  const { values, setValues, setFieldValue, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    initialValues
  );
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);

  const handleError = React.useCallback((message: string, context: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}] ${message}`, error);
    }
  }, []);

  const rentekrav = useRentekravRows({ values, setValues, resyncToken: formVersion });

  const handleBeregningsdatoCommit = React.useCallback<CommitHandler<ISODateString | undefined>>(
    (event) => {
      setFieldValue('beregningsdato', event.target.value);
    },
    [setFieldValue]
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
      setFieldValue('kommentarer', normalized === '' ? undefined : normalized);
    },
    [setFieldValue]
  );

  const handleDownloadRentePdf = React.useCallback(
    async (pdfContext: RentePdfContext) => {
      const actualInterestDateDanish = isoToDanish(pdfContext.actualInterestDate);
      const beregningsdatoDanish = isoToDanish(pdfContext.beregningsdato);
      if (!actualInterestDateDanish || !beregningsdatoDanish) {
        setPdfErrorMessage('Kunne ikke generere rente-PDF.');
        handleError('Ugyldige datoer for PDF-generering', 'Renteberegning.PDFGeneration');
        return;
      }
      const result = await downloadRentePdf({
        beloeb: pdfContext.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        kommentarer: values.kommentarer,
        settings,
        persistedStamdata,
      });
      setPdfErrorMessage(result.success ? null : result.error);
    },
    [persistedStamdata, handleError, settings, values.kommentarer]
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
                minWidth: 140,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'var(--color-primary)',
                height: '2px',
              },
            }}
          >
            <Tab className="tab-item" label="Beregning" value={TAB_KEYS.CALCULATION} />
            <Tab className="tab-item" label="Rentesatser" value={TAB_KEYS.RATES} />
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
          onRentekravReorder={rentekrav.reorderRows}
          onDownloadSpecifikation={handleDownloadRentePdf}
          committedRentekravById={rentekrav.committedById}
          onError={handleError}
          pdfErrorMessage={pdfErrorMessage}
          referenceRates={referenceRates}
          surchargeRates={surchargeRates}
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;

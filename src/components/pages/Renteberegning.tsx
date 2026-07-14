import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
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
import { downloadRenteDokument, downloadRenteOversigtDokument } from '../../document/service/documentService';
import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';
import type { CommitHandler } from '../../types/fieldEvents';
import ContentBox from '../layout/ContentBox';
import RenteberegningTab from './renteberegning/RenteberegningTab';
import RentesatserTab from './renteberegning/RentesatserTab';
import { getDocumentFormatLabel } from '../../document/documentFormat';
import type { ReadyInputRevision } from '../../domain/inputIntegrity/inputBlocker';

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
  const documentFormatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  const initialValues = React.useMemo(() => createRenteberegningInitialValues(), []);
  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
    pageId: 'renteberegning',
    allowedTabs: [TAB_KEYS.RATES, TAB_KEYS.CALCULATION],
    defaultTab: TAB_KEYS.CALCULATION,
  });

  const { values, setValues, setFieldValue, resetForm, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    initialValues
  );
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);
  const [oversigtErrorMessage, setOversigtErrorMessage] = React.useState<string | null>(null);

  const handleError = React.useCallback((message: string, context: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}] ${message}`, error);
    }
  }, []);

  const rentekrav = useRentekravRows({ values, setValues, resyncToken: formVersion });

  const handleBeregningsdatoCommit = React.useCallback<CommitHandler<ISODateString | undefined>>(
    (event) => {
      return setFieldValue('beregningsdato', event.target.value);
    },
    [setFieldValue]
  );

  const handleKommentarerChange = React.useCallback<CommitHandler<string>>(
    (event) => {
      const normalized = event.target.value.trim();
      return setFieldValue('kommentarer', normalized === '' ? undefined : normalized);
    },
    [setFieldValue]
  );

  const handleDownloadRentePdf = React.useCallback(
    async (pdfContext: RentePdfContext, inputRevision: ReadyInputRevision) => {
      const actualInterestDateDanish = isoToDanish(pdfContext.actualInterestDate);
      const beregningsdatoDanish = isoToDanish(pdfContext.beregningsdato);
      if (!actualInterestDateDanish || !beregningsdatoDanish) {
        setPdfErrorMessage(`Kunne ikke generere rente som ${documentFormatLabel}.`);
        handleError('Ugyldige datoer for dokument-generering', 'Renteberegning.DocumentGeneration');
        return;
      }
      const result = await downloadRenteDokument({
        beloeb: pdfContext.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        periods: pdfContext.periods,
        latestReferenceRateDate: isoToDanish(pdfContext.latestReferenceRateDate ?? undefined) ?? null,
        inputRevision,
        kommentarer: values.kommentarer,
        settings,
        persistedStamdata,
      });
      setPdfErrorMessage(result.success ? null : result.error);
    },
    [documentFormatLabel, persistedStamdata, handleError, settings, values.kommentarer]
  );

  const handleDownloadOversigt = React.useCallback(
    async (
      rows: readonly RenteOversigtRow[],
      beregningsdato: ISODateString,
      latestReferenceRateDate: ISODateString | null,
      inputRevision: ReadyInputRevision,
    ) => {
      const result = await downloadRenteOversigtDokument({
        beregningsdato,
        rows,
        latestReferenceRateDate,
        inputRevision,
        kommentarer: values.kommentarer,
        settings,
        persistedStamdata,
      });
      setOversigtErrorMessage(result.success ? null : result.error);
    },
    [settings, persistedStamdata, values.kommentarer]
  );

  return (
    <Box>
      <Typography className="page-title">Renteberegning</Typography>

      <PageTabs
        items={[
          { key: TAB_KEYS.CALCULATION, label: 'Beregning' },
          { key: TAB_KEYS.RATES, label: 'Rentesatser' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

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
          onRentekravBlur={rentekrav.onRowBlur}
          onRentekravDelete={rentekrav.removeRow}
          onRentekravReorder={rentekrav.reorderRows}
          onDownloadSpecifikation={handleDownloadRentePdf}
          committedRentekravById={rentekrav.committedById}
          onError={handleError}
          pdfErrorMessage={pdfErrorMessage}
          referenceRates={referenceRates}
          surchargeRates={surchargeRates}
          ContentBoxComponent={ContentBox}
          onDownloadOversigt={handleDownloadOversigt}
          oversigtErrorMessage={oversigtErrorMessage}
          showOversigtBox
          onClearAll={resetForm}
          documentDownloadFormat={settings.documentDownloadFormat}
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;

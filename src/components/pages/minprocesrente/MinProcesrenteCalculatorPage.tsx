import React from 'react';
import { Box, Typography } from '@mui/material';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { usePersistedForm } from '../../../hooks/usePersistedForm';
import { renteberegningSchema } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import useRentekravRows from '../../tables/useRentekravRows';
import { createRenteberegningInitialValues } from '../../../domain/renteberegning/renteberegningInitialValues';
import type { RentePdfContext } from '../../tables/BeregnetRenteTable';
import { downloadStandaloneRentePdf } from '../../../pdf/infrastructure/standaloneRentePdfService';
import type { CommitHandler } from '../../../types/fieldEvents';
import RenteberegningTab from '../renteberegning/RenteberegningTab';

const MinProcesrenteCalculatorPage = React.memo(() => {
  const initialValues = React.useMemo(() => createRenteberegningInitialValues(), []);
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
        handleError('Ugyldige datoer for PDF-generering', 'MinProcesrente.PDFGeneration');
        return;
      }

      const result = await downloadStandaloneRentePdf({
        beloeb: pdfContext.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        periods: pdfContext.periods,
        latestReferenceRateDate: isoToDanish(pdfContext.latestReferenceRateDate ?? undefined) ?? null,
        kommentarer: values.kommentarer,
      });
      setPdfErrorMessage(result.success ? null : result.error);
    },
    [handleError, values.kommentarer]
  );

  return (
    <Box>
      <Typography className="page-title">Procesrente</Typography>
      <RenteberegningTab
        beregningsdato={values.beregningsdato}
        kommentarer={values.kommentarer}
        onKommentarerCommit={handleKommentarerChange}
        onBeregningsdatoCommit={handleBeregningsdatoCommit}
        rentekravRows={rentekrav.draftRows}
        onRentekravChange={rentekrav.onFieldChange}
        onRentekravBlur={rentekrav.onRowBlur}
        onRentekravReorder={rentekrav.reorderRows}
        onDownloadSpecifikation={handleDownloadRentePdf}
        committedRentekravById={rentekrav.committedById}
        onError={handleError}
        pdfErrorMessage={pdfErrorMessage}
        referenceRates={referenceRates}
        surchargeRates={surchargeRates}
      />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

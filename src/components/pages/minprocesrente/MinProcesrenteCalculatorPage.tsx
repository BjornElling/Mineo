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
import ContentBoxFrame from '../../layout/ContentBoxFrame';
import { downloadStandaloneRentePdf } from '../../../pdf/infrastructure/standaloneRentePdfService';
import type { CommitHandler } from '../../../types/fieldEvents';
import RenteberegningTab from '../renteberegning/RenteberegningTab';

const ignoreStandaloneForwardedError = (): void => {
  // MinProcesrente viser PDF-fejl lokalt og har ingen overliggende Mineo-fejlkanal.
};

const MinProcesrenteCalculatorPage = React.memo(() => {
  const initialValues = React.useMemo(() => createRenteberegningInitialValues(), []);
  const { values, setValues, setFieldValue, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    initialValues
  );
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);

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
    [values.kommentarer]
  );

  return (
    <Box
      sx={{
        '& .page-title': {
          fontSize: { xs: '24px', sm: '28px', md: '32px' },
          marginBottom: { xs: '20px', sm: '24px', md: '32px' },
        },
        '& .content-box': {
          width: '100%',
          maxWidth: '100%',
          padding: { xs: '24px 16px', sm: '32px 24px', md: '40px 32px' },
          borderRadius: { xs: 'var(--border-radius-small)', md: 'var(--border-radius-large)' },
          margin: { xs: '24px 0', md: '40px 0' },
        },
        '& .row--label-right-hover': {
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1, sm: 0 },
          padding: { xs: 0, sm: '0 12px' },
        },
        '& .row--label-right-hover__label, & .hover-row__label': {
          width: { xs: 'auto', sm: 'var(--label-width)' },
          minWidth: { xs: 0, sm: 'var(--label-width)' },
        },
        '& .row--label-right-hover__content': {
          justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          minWidth: { xs: 0, sm: '220px' },
          width: { xs: '100%', sm: 'auto' },
        },
      }}
    >
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
        onError={ignoreStandaloneForwardedError}
        pdfErrorMessage={pdfErrorMessage}
        referenceRates={referenceRates}
        surchargeRates={surchargeRates}
        ContentBoxComponent={ContentBoxFrame}
      />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

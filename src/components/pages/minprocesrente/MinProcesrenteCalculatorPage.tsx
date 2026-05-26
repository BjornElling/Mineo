import React from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { usePersistedForm } from '../../../hooks/usePersistedForm';
import { renteberegningSchema } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import useRentekravRows from '../../tables/useRentekravRows';
import { createRenteberegningInitialValues } from '../../../domain/renteberegning/renteberegningInitialValues';
import type { RentePdfContext, RentekravPdfContextMap } from '../../tables/BeregnetRenteTable';
import ContentBoxFrame from '../../layout/ContentBoxFrame';
import { downloadStandaloneRentePdf, downloadAllStandaloneRentePdf } from '../../../pdf/infrastructure/standaloneRentePdfService';
import type { CommitHandler } from '../../../types/fieldEvents';
import RenteberegningTab from '../renteberegning/RenteberegningTab';
import { referenceRates, surchargeRates } from '../../../data/interestRates';

const ignoreStandaloneForwardedError = (): void => {
  // MinProcesrente viser PDF-fejl lokalt og har ingen overliggende Mineo-fejlkanal.
};

const MinProcesrenteCalculatorPage = React.memo(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mobileContentFontSize = '12px';
  const initialValues = React.useMemo(() => createRenteberegningInitialValues(), []);
  const { values, setValues, setFieldValue, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    initialValues
  );
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);
  const [downloadAllErrorMessage, setDownloadAllErrorMessage] = React.useState<string | null>(null);

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

  const handleDownloadAllSpecifikationer = React.useCallback(async (contexts: RentekravPdfContextMap) => {
    setDownloadAllErrorMessage(null);
    const rows = Array.from(contexts.values()).flatMap((ctx) => {
      const actualInterestDateDanish = isoToDanish(ctx.actualInterestDate);
      const beregningsdatoDanish = isoToDanish(ctx.beregningsdato);
      if (!actualInterestDateDanish || !beregningsdatoDanish) return [];
      return [{
        beloeb: ctx.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        periods: ctx.periods,
        latestReferenceRateDate: isoToDanish(ctx.latestReferenceRateDate ?? undefined) ?? null,
      }];
    });

    const result = await downloadAllStandaloneRentePdf({
      rows,
      kommentarer: values.kommentarer,
    });
    setDownloadAllErrorMessage(result.success ? null : result.error);
  }, [values.kommentarer]);

  return (
    <Box
      sx={{
        // Kun desktop-neutrale regler her — alle mobile overrides i @media (max-width: 599px)
        '& .content-box': {
          width: '100%',
          maxWidth: '100%',
        },
        // page-title: sm/md-størrelser fra designet (overrider global 34px)
        '@media (min-width: 600px) and (max-width: 899px)': {
          '& .page-title': { fontSize: '28px', marginBottom: '24px' },
        },
        '@media (min-width: 900px)': {
          '& .page-title': { fontSize: '32px', marginBottom: '32px' },
        },
        // Alle mobile ændringer — rammer ikke sm+ (600px+)
        '@media (max-width: 599px)': {
          // CSS custom properties for rækkehøjde og linjeafstand
          '--min-height-row': '28px',
          '--spacing-row-vertical': '2px',
          '--minprocesrente-mobile-content-font-size': mobileContentFontSize,

          '& .page-title': {
            fontSize: '20px',
            marginBottom: '16px',
          },
          '& .section-header': {
            fontSize: '15px',
            marginBottom: '8px',
          },
          '& .content-box': {
            padding: '16px 12px',
            borderRadius: 'var(--border-radius-small)',
            margin: '16px 0',
          },
          '& .row--text': {
            fontSize: 'var(--minprocesrente-mobile-content-font-size)',
          },
          '& .content-box--beregningsdato .row--text': {
            fontSize: 'var(--minprocesrente-mobile-content-font-size)',
          },
          '& .MuiTableCell-root, & .MuiInputBase-root, & .MuiInputBase-input, & textarea.MuiInputBase-input': {
            fontSize: 'var(--minprocesrente-mobile-content-font-size)',
          },
          '& .row--label-right-hover': {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: '8px',
            padding: 0,
            minHeight: '28px',
            marginTop: '2px',
            marginBottom: '2px',
            paddingTop: '2px',
            paddingBottom: '2px',
          },
          '& .row--label-right-hover__label, & .hover-row__label': {
            width: 'auto',
            minWidth: 0,
          },
          '& .row--label-right-hover__content': {
            justifyContent: 'flex-end',
            minWidth: 0,
            width: 'auto',
            flex: '0 0 auto',
          },
          '& .row--label-right-hover > .MuiTypography-root.row--text': {
            flex: '1 1 auto',
          },
        },
        // Touch-enheder: fjern hover-baggrundsfarve
        '@media (pointer: coarse)': {
          '& .row--label-right-hover': {
            backgroundColor: 'transparent !important',
          },
          '& .row--label-right-hover:hover': {
            backgroundColor: 'transparent !important',
          },
        },
      }}
    >
      <Typography className="page-title">MinProcesrente</Typography>
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
        isMobile={isMobile}
        onDownloadAllSpecifikationer={handleDownloadAllSpecifikationer}
        downloadAllErrorMessage={downloadAllErrorMessage}
      />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

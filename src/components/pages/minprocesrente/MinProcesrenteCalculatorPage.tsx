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
import { downloadStandaloneRentePdf, downloadAllStandaloneRentePdf, downloadStandaloneRenteOversigtPdf } from '../../../pdf/infrastructure/standaloneRentePdfService';
import type { RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import type { CommitHandler } from '../../../types/fieldEvents';
import RenteberegningTab from '../renteberegning/RenteberegningTab';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';
import { useUndoRedoShortcuts } from '../../../hooks/useUndoRedoShortcuts';
import SiblingSitesFooter from '../../layout/SiblingSitesFooter';

const ignoreStandaloneForwardedError = (): void => {
  // MinProcesrente viser PDF-fejl lokalt og har ingen overliggende Mineo-fejlkanal.
};

const noopUndoRedoNavigate = (): void => {
  // Standalone MinProcesrente har kun én side og ingen router. Undo/redo-restore
  // gendanner committed state og fokus, men navigerer ikke (intet at navigere til).
};

const MinProcesrenteTitle = React.memo(() => (
  <Typography className="page-title" component="h1">
    <Box className="page-title-link" component="a" href="/" aria-label="minProcesrente.dk">
      <Box className="page-title-prefix" component="span">min</Box>
      <Box className="page-title-main" component="span">Procesrente</Box>
      <Box className="page-title-prefix" component="span">.dk</Box>
    </Box>
  </Typography>
));

MinProcesrenteTitle.displayName = 'MinProcesrenteTitle';

const MinProcesrenteCalculatorPage = React.memo(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mobileContentFontSize = '12px';
  const initialValues = React.useMemo(() => createRenteberegningInitialValues(), []);
  const { values, setValues, setFieldValue, resetForm, formVersion } = usePersistedForm(
    renteberegningSchema,
    'renteberegning',
    initialValues
  );
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);
  const [downloadAllErrorMessage, setDownloadAllErrorMessage] = React.useState<string | null>(null);
  const [oversigtErrorMessage, setOversigtErrorMessage] = React.useState<string | null>(null);

  // Global undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y) + focus-tracker.
  // Samme delte wiring som Mineos MainLayout; standalone navigerer ikke (én side).
  useUndoRedoShortcuts(noopUndoRedoNavigate);

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

  const handleDownloadOversigt = React.useCallback(async (
    rows: readonly RenteOversigtRow[],
    beregningsdato: ISODateString,
  ) => {
    const result = await downloadStandaloneRenteOversigtPdf({ beregningsdato, rows, kommentarer: values.kommentarer });
    setOversigtErrorMessage(result.success ? null : result.error);
  }, [values.kommentarer]);

  return (
    <Box
      sx={{
        // BEVIDST UNDTAGELSE fra desktop-only-stylingreglen (AGENTS.md "Desktop-only gate":
        // mobil/tablet-styling hører normalt kun til UnsupportedDevicePage.tsx). Standalone
        // MinProcesrente er bevidst mobil-tilladt (egen entry, `enforceUnsupportedDeviceGate:
        // false`), så denne @media-styling er variant-lokal og kun aktiv i standalone-buildet —
        // den rammer aldrig Mineos desktop-only-flade. Jf. app-shell-contract.md §5.
        // Re-evaluering hvis standalone en dag gøres desktop-only.
        // Kun desktop-neutrale regler her — alle mobile overrides i @media (max-width: 599px)
        '& .content-box': {
          width: '100%',
          maxWidth: '100%',
        },
        // page-title: sm/md-størrelser fra designet (overrider global 34px)
        '& .page-title': {
          lineHeight: 'var(--line-height-base)',
        },
        '& .page-title-link': {
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        },
        '& .page-title-main, & .page-title-prefix': {
          transition: 'color 520ms ease',
        },
        '& .page-title-main': {
          color: 'var(--color-text-primary)',
        },
        '& .page-title-prefix': {
          color: 'rgba(0, 0, 0, 0.42)',
        },
        '& .page-title-link:hover .page-title-main, & .page-title-link:active .page-title-main, & .page-title-link:focus-visible .page-title-main': {
          color: '#4f6f8f',
        },
        '& .page-title-link:hover .page-title-prefix, & .page-title-link:active .page-title-prefix, & .page-title-link:focus-visible .page-title-prefix': {
          color: 'var(--color-surface)',
        },
        '& .page-title-link:focus-visible': {
          outline: '2px solid var(--color-primary)',
          outlineOffset: '3px',
        },
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
          // Global mobil-fontstørrelse for alle row--text (inkl. beregningsdato-boksen og tabellens talværdier).
          '& .row--text': {
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
      <MinProcesrenteTitle />
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
        onError={ignoreStandaloneForwardedError}
        pdfErrorMessage={pdfErrorMessage}
        referenceRates={referenceRates}
        surchargeRates={surchargeRates}
        ContentBoxComponent={ContentBoxFrame}
        isMobile={isMobile}
        onDownloadAllSpecifikationer={handleDownloadAllSpecifikationer}
        downloadAllErrorMessage={downloadAllErrorMessage}
        onDownloadOversigt={handleDownloadOversigt}
        oversigtErrorMessage={oversigtErrorMessage}
        showOversigtBox
        onClearAll={resetForm}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
      <SiblingSitesFooter currentSite="minprocesrente" compactOnNarrowScreens />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

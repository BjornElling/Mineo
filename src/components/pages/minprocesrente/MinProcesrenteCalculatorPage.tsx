import React from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import type { RentePdfContext, RentekravPdfContextMap } from '../../tables/BeregnetRenteTable';
import ContentBoxFrame from '../../layout/ContentBoxFrame';
import type { RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import RenteberegningTab from '../renteberegning/RenteberegningTab';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';
import { useGreenfieldUndoRedoShortcuts } from '../../../inputCore/react/useGreenfieldUndoRedoShortcuts';
import { captureProductionEvaluationSource } from '../../../inputCore/react/productionInputRuntime';
import { renteberegningKommentarerField } from '../../../inputCore/catalog/renteberegningDescriptors';
import SiblingSitesFooter from '../../layout/SiblingSitesFooter';
import { isTouchLikeDeviceWithShortestSideAtMost } from '../../../utils/clientDevice';

const MOBILE_LAYOUT_MAX_SHORTEST_SCREEN_SIDE_PX = 599;

const kommentarerRef = renteberegningKommentarerField.bind();

/**
 * Optager ét frisk kildesnapshot fra den ene runtime (§3.9): den afsluttede kommentar OG friskheds-closuren
 * (`isSourceCurrent`), så et netop indtastet felt kommer med, og downloaden fail-closer, hvis input ændres under
 * den asynkrone PDF-generering.
 */
const captureFreshStandaloneSource = (): Readonly<{ kommentarer: string | undefined; isSourceCurrent: () => boolean }> => {
  const source = captureProductionEvaluationSource();
  const read = source.evaluation.reader.read(kommentarerRef);
  return {
    kommentarer: read.status === 'usable' ? read.value : undefined,
    isSourceCurrent: source.isSourceCurrent,
  };
};

// PDF-tjenesten trækker jsPDF + dokument-generatorerne ind (~110 KiB). Den er kun
// nødvendig når brugeren downloader, så den lazy-loades her frem for at ligge i sidens
// initiale bundle. Det er den eneste runtime-sti der bringer jsPDF ind i standalone-buildet,
// så en dynamisk import fjerner den fra first load (Lighthouse: "Reducer ubrugt JavaScript").
const loadStandaloneRentePdfService = () =>
  import('../../../pdf/infrastructure/standaloneRentePdfService');

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

const isStandalonePhoneLikeDevice = (): boolean => {
  return isTouchLikeDeviceWithShortestSideAtMost(MOBILE_LAYOUT_MAX_SHORTEST_SCREEN_SIDE_PX);
};

const MinProcesrenteCalculatorPage = React.memo(() => {
  const theme = useTheme();
  const isViewportMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isPhoneLikeDevice] = React.useState(isStandalonePhoneLikeDevice);
  const isMobile = isViewportMobile || isPhoneLikeDevice;
  const mobileContentFontSize = '12px';
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);
  const [downloadAllErrorMessage, setDownloadAllErrorMessage] = React.useState<string | null>(null);
  const [oversigtErrorMessage, setOversigtErrorMessage] = React.useState<string | null>(null);

  // Global undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y) mod den ene greenfield write-grænse.
  useGreenfieldUndoRedoShortcuts();

  const handleDownloadRentePdf = React.useCallback(
    async (pdfContext: RentePdfContext, _isSourceCurrent: () => boolean) => {
      const actualInterestDateDanish = isoToDanish(pdfContext.actualInterestDate);
      const beregningsdatoDanish = isoToDanish(pdfContext.beregningsdato);
      if (!actualInterestDateDanish || !beregningsdatoDanish) {
        setPdfErrorMessage('Kunne ikke generere rente-PDF.');
        return;
      }

      const { kommentarer, isSourceCurrent } = captureFreshStandaloneSource();
      const { downloadStandaloneRentePdf } = await loadStandaloneRentePdfService();
      const result = await downloadStandaloneRentePdf({
        beloeb: pdfContext.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        periods: pdfContext.periods,
        latestReferenceRateDate: isoToDanish(pdfContext.latestReferenceRateDate ?? undefined) ?? null,
        isSourceCurrent,
        kommentarer,
      });
      setPdfErrorMessage(result.success ? null : result.error);
    },
    []
  );

  const handleDownloadAllSpecifikationer = React.useCallback(async (
    contexts: RentekravPdfContextMap,
    _isSourceCurrent: () => boolean
  ) => {
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

    const { kommentarer, isSourceCurrent } = captureFreshStandaloneSource();
    const { downloadAllStandaloneRentePdf } = await loadStandaloneRentePdfService();
    const result = await downloadAllStandaloneRentePdf({
      rows,
      isSourceCurrent,
      kommentarer,
    });
    setDownloadAllErrorMessage(result.success ? null : result.error);
  }, []);

  const handleDownloadOversigt = React.useCallback(async (
    rows: readonly RenteOversigtRow[],
    beregningsdato: ISODateString,
    latestReferenceRateDate: ISODateString | null,
    _isSourceCurrent: () => boolean,
  ) => {
    const { kommentarer, isSourceCurrent } = captureFreshStandaloneSource();
    const { downloadStandaloneRenteOversigtPdf } = await loadStandaloneRentePdfService();
    const result = await downloadStandaloneRenteOversigtPdf({
      beregningsdato,
      rows,
      latestReferenceRateDate,
      isSourceCurrent,
      kommentarer,
    });
    setOversigtErrorMessage(result.success ? null : result.error);
  }, []);

  return (
    <Box
      sx={{
        // BEVIDST UNDTAGELSE fra desktop-only-stylingreglen (AGENTS.md "Desktop-only gate":
        // mobil/tablet-styling hører normalt kun til UnsupportedDevicePage.tsx). Standalone
        // MinProcesrente er bevidst mobil-tilladt (egen entry, `enforceUnsupportedDeviceGate:
        // false`), så denne @media-styling er variant-lokal og kun aktiv i standalone-buildet —
        // den rammer aldrig Mineos desktop-only-flade. Jf. app-shell-contract.md §5.
        // Re-evaluering hvis standalone en dag gøres desktop-only.
        // Kun desktop-neutrale regler her — mobilens .content-box-bredde ejes af
        // minprocesrente.css, så den kan vinde deterministisk over global layout.css.
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
        // BEVIDST DESIGNBESLUTNING (må ikke "rettes"): præfikset "min" og suffikset ".dk"
        // holdes med lav kontrast for at trække fokus til selve ordet "Procesrente".
        // Mønsteret går igen på tværs af familien af søskendesider (minEO.dk,
        // minDomssamling.dk, minParadigmesamling.dk). Lighthouse/axe rapporterer derfor
        // bevidst en kontrast-advarsel for `.page-title-prefix` — den er forventet og
        // accepteret og skal IKKE afhjælpes ved at hæve kontrasten.
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
        ...(isMobile && {
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
        }),
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
        onDownloadSpecifikation={handleDownloadRentePdf}
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
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
      <SiblingSitesFooter currentSite="minprocesrente" />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

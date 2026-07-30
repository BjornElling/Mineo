import React from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import ContentBoxFrame from '../../layout/ContentBoxFrame';
import RenteberegningTab from '../renteberegning/RenteberegningTab';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';
import {
  standaloneRenteAlleDocumentDefinition,
  standaloneRenteDocumentDefinition,
  standaloneRenteOversigtDocumentDefinition,
} from '../../../apps/minprocesrente/document/standaloneRenteDocumentDefinitions';
import {
  useStandaloneDocumentOutput,
  useStandaloneDocumentSourceContext,
} from '../../../apps/minprocesrente/document/useStandaloneDocumentOutput';
import { useUndoRedoShortcuts } from '../../../inputCore/react/useUndoRedoShortcuts';
import SiblingSitesFooter from '../../layout/SiblingSitesFooter';
import { isTouchLikeDeviceWithShortestSideAtMost } from '../../../utils/clientDevice';

const MOBILE_LAYOUT_MAX_SHORTEST_SCREEN_SIDE_PX = 599;

/**
 * Rækkeknappernes reaktive gate kommer fra tabellens projektion, ikke fra handlens `canDownload`:
 * ét handle kan ikke repræsentere N rækkers gate. `download(request)` kaldes med den klikkede
 * rækkes id, og gate-requesten peger derfor på en tom rækkeid, hvis gateværdi ikke bruges.
 */
const STANDALONE_RENTE_GATE_REQUEST = { rowId: '' } as const;

// jsPDF + generatorerne (~110 KiB) er fortsat UDEN FOR standalones first load: definitionernes
// `loadRenderer` bruger dynamisk `import()`, og selve definitionsmodulet trækker kun
// projektion/gate/descriptorer ind. Lighthouse-hensynet fra den tidligere manuelle
// service-lazy-load er dermed bevaret uden en side-lokal loader.

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
  // Global undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y) mod den ene den ene write-grænse.
  useUndoRedoShortcuts();

  // Dokument-download: de tre standalone-outputs komponeres her mod standalones eget
  // miljø (fast PDF, intet brevhoved, lokal fejl-sink) og videregives som færdige handles til den
  // delte fane. Tidligere kaldte siden `standaloneRentePdfService` direkte, uden commit-barriere
  // og uden gate.
  const documentContext = useStandaloneDocumentSourceContext();
  // Rækkeknappernes reaktive gate kommer fra tabellens projektion, ikke fra dette handle; jf. noten
  // i Mineos `Renteberegning.tsx`.
  const renteDownload = useStandaloneDocumentOutput(
    standaloneRenteDocumentDefinition,
    STANDALONE_RENTE_GATE_REQUEST,
    documentContext
  );
  const renteAlleDownload = useStandaloneDocumentOutput(
    standaloneRenteAlleDocumentDefinition,
    undefined,
    documentContext
  );
  const renteOversigtDownload = useStandaloneDocumentOutput(
    standaloneRenteOversigtDocumentDefinition,
    undefined,
    documentContext
  );

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
        renteDownload={renteDownload}
        referenceRates={referenceRates}
        surchargeRates={surchargeRates}
        ContentBoxComponent={ContentBoxFrame}
        isMobile={isMobile}
        renteAlleDownload={renteAlleDownload}
        renteOversigtDownload={renteOversigtDownload}
        showOversigtBox
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
      <SiblingSitesFooter currentSite="minprocesrente" />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

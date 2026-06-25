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

const ignoreStandaloneForwardedError = (): void => {
  // MinProcesrente viser PDF-fejl lokalt og har ingen overliggende Mineo-fejlkanal.
};

const noopUndoRedoNavigate = (): void => {
  // Standalone MinProcesrente har kun én side og ingen router. Undo/redo-restore
  // gendanner committed state og fokus, men navigerer ikke (intet at navigere til).
};

const SIBLING_SITES = [
  { key: 'mineo', label: 'minEO.dk', href: 'https://mineo.dk' },
  { key: 'mindomssamling', label: 'minDomssamling.dk', href: 'https://mindomssamling.dk' },
  { key: 'minparadigmesamling', label: 'minParadigmesamling.dk', href: 'https://minparadigmesamling.dk' },
  { key: 'minprocesrente', label: 'minProcesrente.dk', href: 'https://minprocesrente.dk' },
] as const;

// Footer-ikoner som tynde inline-SVG'er (stroke, ikke fill). Identiske med
// søster-siden minDomssamling, så footeren ser præcis ens ud på tværs af sites.
// MUI's icon-glyffer er fyldte og kan ikke gøres visuelt identiske med disse.
const MailIcon = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const SiteIcon = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 0 20" />
    <path d="M12 2a15.3 15.3 0 0 0 0 20" />
  </svg>
);

const ActiveIcon = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

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

const MinProcesrenteSiteFooter = React.memo(() => (
  <Box className="content-box site-footer-box" component="section" aria-label="Søskendesider og kontakt">
    <Box className="site-footer">
      <Box className="site-footer__mail" component="a" href="mailto:bel@fho.dk" aria-label="Kontakt bel@fho.dk">
        <Box className="site-footer__mail-icon" component="span" aria-hidden="true">
          <MailIcon />
        </Box>
        <Box className="site-footer__mail-text" component="span">
          <Box className="site-footer__mail-label" component="span">Kontakt</Box>
          <Box className="site-footer__mail-value" component="span">bel@fho.dk</Box>
        </Box>
      </Box>

      <Box className="site-footer__sep" aria-hidden="true" />

      <Box className="site-footer__nav" component="nav" aria-label="Søskendesider">
        {SIBLING_SITES.map((site) => {
          const isCurrentSite = site.key === 'minprocesrente';
          const icon = isCurrentSite ? <ActiveIcon /> : <SiteIcon />;
          const content = (
            <>
              <Box className="site-footer__link-icon" component="span" aria-hidden="true">
                {icon}
              </Box>
              <Box component="span">{site.label}</Box>
            </>
          );

          return isCurrentSite ? (
            <Box
              key={site.key}
              className="site-footer__link site-footer__link--active"
              component="span"
              aria-current="page"
            >
              {content}
            </Box>
          ) : (
            <Box key={site.key} className="site-footer__link" component="a" href={site.href}>
              {content}
            </Box>
          );
        })}
      </Box>
    </Box>
  </Box>
));

MinProcesrenteSiteFooter.displayName = 'MinProcesrenteSiteFooter';

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
        '& .site-footer-box': {
          marginTop: '40px',
          marginBottom: '32px',
          padding: '24px 32px',
        },
        '& .site-footer': {
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        },
        '& .site-footer__mail': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: '44px',
          color: 'var(--color-text-primary)',
          textDecoration: 'none',
          maxWidth: '100%',
          overflowWrap: 'anywhere',
          flex: '0 0 auto',
        },
        '& .site-footer__mail-text': {
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.25,
          minWidth: 0,
        },
        '& .site-footer__mail-label': {
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          fontWeight: 'var(--font-weight-medium)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
        '& .site-footer__mail-value': {
          fontSize: '14px',
          fontWeight: 'var(--font-weight-medium)',
          transition: 'color 150ms ease',
        },
        '& .site-footer__mail:hover .site-footer__mail-value': {
          color: 'var(--color-primary)',
        },
        '& .site-footer__mail:focus-visible, & .site-footer__link:focus-visible': {
          outline: '2px solid var(--color-primary)',
          outlineOffset: '3px',
        },
        '& .site-footer__mail-icon, & .site-footer__link-icon': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        },
        '& .site-footer__mail-icon': {
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          backgroundColor: 'rgba(25, 118, 210, 0.06)',
          border: '1px solid rgba(25, 118, 210, 0.28)',
          color: 'var(--color-primary)',
        },
        '& .site-footer__mail-icon svg, & .site-footer__link-icon svg': {
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        '& .site-footer__mail-icon svg': {
          width: '18px',
          height: '15px',
        },
        '& .site-footer__sep': {
          width: '1px',
          alignSelf: 'stretch',
          backgroundColor: 'var(--color-border)',
          flex: '0 0 auto',
        },
        '& .site-footer__nav': {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginLeft: 'auto',
        },
        '& .site-footer__link': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          minWidth: 0,
          padding: '8px 14px',
          color: 'var(--color-text-primary)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '999px',
          fontSize: '12.5px',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 1.2,
          textDecoration: 'none',
          transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
        },
        '& .site-footer__link-icon svg': {
          width: '13px',
          height: '13px',
          color: 'var(--color-primary)',
        },
        '& .site-footer__link:hover': {
          color: 'var(--color-primary)',
          backgroundColor: 'var(--color-hover)',
          borderColor: 'rgba(25, 118, 210, 0.24)',
        },
        '& .site-footer__link--active': {
          color: 'var(--color-primary)',
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
          borderColor: 'rgba(25, 118, 210, 0.28)',
          cursor: 'default',
        },
        '& .site-footer__link span:last-child': {
          minWidth: 0,
          overflowWrap: 'anywhere',
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
          '& .site-footer-box': {
            padding: '24px 16px',
          },
          '& .site-footer': {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '14px',
          },
          '& .site-footer__nav': {
            flexDirection: 'column',
            alignItems: 'stretch',
          },
          '& .site-footer__link': {
            justifyContent: 'flex-start',
          },
        },
        '@media (max-width: 899px)': {
          '& .site-footer__nav': {
            marginLeft: 0,
          },
          '& .site-footer__sep': {
            display: 'none',
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
      <MinProcesrenteSiteFooter />
    </Box>
  );
});

MinProcesrenteCalculatorPage.displayName = 'MinProcesrenteCalculatorPage';

export default MinProcesrenteCalculatorPage;

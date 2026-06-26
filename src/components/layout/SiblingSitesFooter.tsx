import React from 'react';
import { Box } from '@mui/material';
import { useInstalledPwaDisplayMode } from '../../hooks/useInstalledPwaDisplayMode';

type SiblingSiteKey = 'mineo' | 'mindomssamling' | 'minparadigmesamling' | 'minprocesrente';

type SiblingSitesFooterProps = {
  currentSite: SiblingSiteKey;
  compactOnNarrowScreens?: boolean;
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

const SiblingSitesFooter = React.memo(({
  currentSite,
  compactOnNarrowScreens = false,
}: SiblingSitesFooterProps) => {
  const openSiteLinksInBrowser = useInstalledPwaDisplayMode();
  const siteLinkTargetProps = openSiteLinksInBrowser
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <Box
      className="content-box site-footer-box"
      component="section"
      aria-label="Søskendesider og kontakt"
      sx={[
        {
          marginTop: '40px',
          marginBottom: '32px',
          padding: '24px 32px',
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
        },
        compactOnNarrowScreens
          ? {
            '@media (max-width: 599px)': {
              padding: '24px 16px',
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
          }
          : null,
      ]}
    >
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
            const isCurrentSite = site.key === currentSite;
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
              <Box
                key={site.key}
                className="site-footer__link"
                component="a"
                href={site.href}
                {...siteLinkTargetProps}
              >
                {content}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
});

SiblingSitesFooter.displayName = 'SiblingSitesFooter';

export default SiblingSitesFooter;

import React from 'react';
import { Box } from '@mui/material';
import { useInstalledPwaDisplayMode } from '../../hooks/useInstalledPwaDisplayMode';

type SiblingSiteKey = 'mineo' | 'mindomssamling' | 'minparadigmesamling' | 'minprocesrente';

type SiblingSitesFooterProps = {
  currentSite: SiblingSiteKey;
};

const SIBLING_SITES = [
  { key: 'mineo', label: 'minEO.dk', href: 'https://mineo.dk' },
  { key: 'mindomssamling', label: 'minDomssamling.dk', href: 'https://mindomssamling.dk' },
  { key: 'minparadigmesamling', label: 'minParadigmesamling.dk', href: 'https://minparadigmesamling.dk' },
  { key: 'minprocesrente', label: 'minProcesrente.dk', href: 'https://minprocesrente.dk' },
] as const;

const MailIcon = (): React.ReactElement => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const SiblingSitesFooter = React.memo(({ currentSite }: SiblingSitesFooterProps) => {
  const openSiteLinksInBrowser = useInstalledPwaDisplayMode();
  const siteLinkTargetProps = openSiteLinksInBrowser
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  const renderFooterLink = (site: (typeof SIBLING_SITES)[number]) => {
    const isCurrentSite = site.key === currentSite;
    const content = (
      <Box component="span">{site.label}</Box>
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
  };

  return (
    <Box
      className="content-box site-footer-box"
      component="section"
      aria-label="Søskendesider og kontakt"
      sx={[
        {
          marginTop: '40px',
          marginBottom: 0,
          padding: '17px 56px 17px 32px',
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
            minHeight: '39px',
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
            lineHeight: 1.25,
            transform: 'translateY(-1px)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
          '& .site-footer__mail-value': {
            fontSize: '14px',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 1.25,
            marginTop: '-2px',
            transition: 'color 150ms ease',
          },
          '& .site-footer__mail:hover .site-footer__mail-value': {
            color: 'var(--color-primary)',
          },
          '& .site-footer__mail:focus-visible, & .site-footer__link:focus-visible': {
            outline: '2px solid var(--color-primary)',
            outlineOffset: '3px',
          },
          '& .site-footer__mail-icon': {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            width: '35px',
            height: '35px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.07)',
            color: 'var(--color-text-secondary)',
          },
          '& .site-footer__mail-icon svg': {
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            width: '18px',
            height: '15px',
          },
          '& .site-footer__sep': {
            width: '1px',
            height: '32px',
            margin: '0 10px',
            backgroundColor: 'var(--color-border)',
            flex: '0 0 auto',
          },
          '& .site-footer__nav': {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            marginLeft: 'auto',
          },
          '& .site-footer__nav--mobile': {
            display: 'none',
          },
          '& .site-footer__link': {
            display: 'inline-flex',
            alignItems: 'center',
            position: 'relative',
            minWidth: 0,
            minHeight: '39px',
            padding: '4px 0',
            color: 'var(--color-text-primary)',
            fontSize: '12.5px',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 1.2,
            textDecoration: 'none',
            transition: 'color 150ms ease',
          },
          '& .site-footer__link + .site-footer__link': {
            marginLeft: '56px',
          },
          '& .site-footer__link + .site-footer__link::before': {
            content: '""',
            position: 'absolute',
            left: '-31px',
            top: '50%',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.28)',
            transform: 'translateY(-50%)',
          },
          '& .site-footer__link:hover': {
            color: 'var(--color-primary)',
          },
          '& .site-footer__link--active:hover': {
            color: 'var(--color-primary)',
          },
          '& .site-footer__link--active': {
            color: 'var(--color-primary)',
            cursor: 'default',
          },
          '& .site-footer__link span:last-child': {
            minWidth: 0,
            paddingBottom: '1px',
            borderBottom: '1px solid transparent',
            overflowWrap: 'anywhere',
            transition: 'border-color 150ms ease',
          },
          '& .site-footer__link:hover span:last-child': {
            borderBottomColor: 'rgba(25, 118, 210, 0.24)',
          },
          '& .site-footer__link--active:hover span:last-child, & .site-footer__link--active span:last-child': {
            borderBottomColor: 'var(--color-primary)',
          },
        },
        {
          '@media (max-width: 640px)': {
            padding: '24px 16px',
            '& .site-footer': {
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '10px',
            },
            '& .site-footer__nav--desktop': {
              display: 'none',
            },
            '& .site-footer__nav--mobile': {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              rowGap: '3px',
            },
            '& .site-footer__mobile-row': {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              maxWidth: '100%',
            },
            '& .site-footer__mobile-sep': {
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.28)',
              flex: '0 0 auto',
            },
            '& .site-footer__link': {
              justifyContent: 'flex-start',
              minHeight: '28px',
              padding: '2px 0',
            },
            '& .site-footer__link + .site-footer__link': {
              marginLeft: 0,
            },
            '& .site-footer__link + .site-footer__link::before': {
              display: 'none',
            },
            '& .site-footer__link span:last-child': {
              overflowWrap: 'normal',
              whiteSpace: 'nowrap',
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
        },
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

        <Box className="site-footer__nav site-footer__nav--desktop" component="nav" aria-label="Søskendesider">
          {SIBLING_SITES.map(renderFooterLink)}
        </Box>

        <Box className="site-footer__nav site-footer__nav--mobile" component="nav" aria-label="Søskendesider">
          <Box className="site-footer__mobile-row">
            {renderFooterLink(SIBLING_SITES[0])}
            <Box className="site-footer__mobile-sep" component="span" aria-hidden="true" />
            {renderFooterLink(SIBLING_SITES[2])}
          </Box>
          <Box className="site-footer__mobile-row">
            {renderFooterLink(SIBLING_SITES[1])}
            <Box className="site-footer__mobile-sep" component="span" aria-hidden="true" />
            {renderFooterLink(SIBLING_SITES[3])}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

SiblingSitesFooter.displayName = 'SiblingSitesFooter';

export default SiblingSitesFooter;

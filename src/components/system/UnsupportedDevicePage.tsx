import React, { useEffect } from 'react';
import { VERSION } from '../../config/buildInfo';
import {
  SIBLING_SITES,
  SIBLING_SITES_CONTACT_EMAIL,
  type SiblingSite,
} from '../layout/siblingSites';

const pageTitleStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.87)',
  fontSize: '20px',
  fontWeight: 500,
  lineHeight: 1.4,
  margin: '0 0 16px',
  padding: 0,
};

const pageTitleMainStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.87)',
};

const pageTitlePrefixStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.42)',
};

const UnsupportedDeviceTitle = () => (
  <h1 aria-label="minEO.dk" style={pageTitleStyle}>
    <span style={pageTitlePrefixStyle}>min</span>
    <span style={pageTitleMainStyle}>EO</span>
    <span style={pageTitlePrefixStyle}>.dk</span>
  </h1>
);

UnsupportedDeviceTitle.displayName = 'UnsupportedDeviceTitle';

/**
 * Søskendesider + kontakt på hard-stop-siden.
 *
 * Den deler kun DATA med `SiblingSitesFooter` (`layout/siblingSites.ts`) – ikke styling.
 * Grunden er sidens bevidste isolation (se noten på selve siden nedenfor): hard-stop-siden
 * indlæser hverken app-stylesheet, MUI-tema eller CSS-variabler, så den delte footer ville
 * rendere ustylet her. Al styling er derfor inline og selvbærende, præcis som resten af siden.
 *
 * Linkene er de eneste vej videre for en mobilbruger, der lige har fået at vide, at Mineo
 * kræver en computer – derfor er de tabbare her (i modsætning til `ExternalLink`s `tabIndex={-1}`,
 * som findes for ikke at forurene programmets egen tastaturrækkefølge; der er intet program at
 * forurene på denne side).
 *
 * Fordi stylingen er en DUBLET og ikke et genbrug, er de tal, der bærer geometrien, låst mod
 * footerens mobilværdier af `quality/unsupportedDeviceFooterParity`. Den test findes, fordi
 * dubletten første gang blev afleveret med prosaen «målt til at være geometrisk identisk» – og tre
 * højdeerklæringer var aldrig kommet med, så boksen stod 26 px lavere end søskendesidens. En
 * måling foretaget én gang er ikke et værn; testen er.
 */

/**
 * Højde- og padding-værdierne er ikke pynt: de er footerens mobile `.site-footer__link`
 * (`minHeight: 28px`, `padding: 2px 0`).
 *
 * `borderBottom`/`paddingBottom` sidder i footeren på linkets inderste span, ikke på linket selv;
 * her er de to lag slået sammen til ét element, så understregningen skal ligge på et indre span,
 * ellers ville den løbe langs hele den 28 px høje række i stedet for tættest under teksten.
 */
const siblingLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  minHeight: '28px',
  padding: '2px 0',
  // `border-box` er ikke kosmetik her. Footeren arver MUI'ens globale `box-sizing: border-box`,
  // så dens `minHeight: 28px` ER rækkens ydre højde med padding inkluderet. Denne side har intet
  // stylesheet og dermed browserens `content-box`, hvor de samme to erklæringer i stedet giver
  // 28+2+2 = 32 px – fire pixel pr. række, otte i boksen.
  boxSizing: 'border-box',
  color: 'rgba(0, 0, 0, 0.87)',
  fontSize: '12.5px',
  fontWeight: 500,
  lineHeight: 1.2,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const siblingLinkTextStyle: React.CSSProperties = {
  borderBottom: '1px solid transparent',
  paddingBottom: '1px',
};

const siblingCurrentStyle: React.CSSProperties = {
  ...siblingLinkStyle,
  color: '#1976d2',
  cursor: 'default',
};

const siblingCurrentTextStyle: React.CSSProperties = {
  ...siblingLinkTextStyle,
  borderBottomColor: '#1976d2',
};

const siblingSeparatorStyle: React.CSSProperties = {
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  backgroundColor: 'rgba(0, 0, 0, 0.28)',
  flex: '0 0 auto',
};

const siblingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  maxWidth: '100%',
};

const renderSiblingSite = (site: SiblingSite) => (
  site.key === 'mineo' ? (
    <span key={site.key} aria-current="page" style={siblingCurrentStyle}>
      <span style={siblingCurrentTextStyle}>{site.label}</span>
    </span>
  ) : (
    <a
      key={site.key}
      className="unsupported-sibling-link"
      href={site.href}
      target="_blank"
      rel="noopener noreferrer"
      style={siblingLinkStyle}
    >
      <span style={siblingLinkTextStyle}>{site.label}</span>
    </a>
  )
);

/**
 * Fokusringen kan ikke sættes inline (`:focus-visible` er en pseudoklasse), og siden har bevidst
 * intet stylesheet. Ét lokalt `<style>`-element er derfor den eneste vej til samme fokusmarkering
 * som den delte footer – og det holder isolationen, fordi det ikke er en import.
 */
const siblingFocusStyles = `
  .unsupported-sibling-link:focus-visible,
  .unsupported-contact-link:focus-visible {
    outline: 2px solid #1976d2;
    outline-offset: 3px;
    border-radius: 2px;
  }
`;

const UnsupportedDeviceSiblingSites = () => (
  <section
    aria-label="Søskendesider og kontakt"
    style={{
      width: '100%',
      maxWidth: '1200px',
      backgroundColor: '#ffffff',
      border: '1px solid rgba(0, 0, 0, 0.08)',
      borderRadius: '10px',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
      padding: '16px 12px',
      // Samme `margin: 16px 0` som indholdsboksen ovenfor – det er dén værdi minProcesrentes
      // mobile `.content-box` giver footeren, og den nedre halvdel må ikke falde væk her.
      margin: '16px 0',
      boxSizing: 'border-box',
    }}
  >
    <style>{siblingFocusStyles}</style>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '10px',
      }}
    >
      <a
        className="unsupported-contact-link"
        href={`mailto:${SIBLING_SITES_CONTACT_EMAIL}`}
        aria-label={`Kontakt ${SIBLING_SITES_CONTACT_EMAIL}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: '39px',
          color: 'rgba(0, 0, 0, 0.87)',
          textDecoration: 'none',
          maxWidth: '100%',
          // Ingen `alignSelf: 'flex-start'`: footerens `.site-footer__mail` er `flex: 0 0 auto` i
          // en `align-items: stretch`-kolonne og fylder derfor rækkens fulde bredde. Indholdet
          // ligger venstrestillet i begge, så forskellen er usynlig – men den fulde bredde ER
          // trykfladen, og på en touch-only side skal målet være det samme som på søskendesiden.
          overflowWrap: 'anywhere',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            width: '35px',
            height: '35px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.07)',
            color: 'rgba(0, 0, 0, 0.6)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="15"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
          <span
            style={{
              color: 'rgba(0, 0, 0, 0.6)',
              fontSize: '11px',
              fontWeight: 500,
              lineHeight: 1.25,
              transform: 'translateY(-1px)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Kontakt
          </span>
          <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.25, marginTop: '-2px' }}>
            {SIBLING_SITES_CONTACT_EMAIL}
          </span>
        </span>
      </a>

      <nav
        aria-label="Søskendesider"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          rowGap: '3px',
        }}
      >
        {/* Samme 2×2-opdeling som den delte footers mobilvisning: minEO + minParadigmesamling
            øverst, minDomssamling + minProcesrente nederst. */}
        <div style={siblingRowStyle}>
          {renderSiblingSite(SIBLING_SITES[0])}
          <span aria-hidden="true" style={siblingSeparatorStyle} />
          {renderSiblingSite(SIBLING_SITES[2])}
        </div>
        <div style={siblingRowStyle}>
          {renderSiblingSite(SIBLING_SITES[1])}
          <span aria-hidden="true" style={siblingSeparatorStyle} />
          {renderSiblingSite(SIBLING_SITES[3])}
        </div>
      </nav>
    </div>
  </section>
);

UnsupportedDeviceSiblingSites.displayName = 'UnsupportedDeviceSiblingSites';

/**
 * NOTE (bevidst undtagelse):
 * Denne side er en hard-stop gate for mobil/tablet og er derfor designet til at være
 * fuldt isoleret fra app'ens centrale layout-styring.
 *
 * BEVIDST GLOBAL SIDE EFFECT:
 * For at opnå korrekt visuel baggrund helt ned til (og visuelt bag) browserens UI
 * sættes baggrundsfarve midlertidigt på <html>-elementet samt via theme-color meta-tag.
 *
 * Ændringerne er fuldt reversible og ryddes op ved unmount.
 */
const UnsupportedDevicePage = () => {
  useEffect(() => {
    const html = document.documentElement;
    const originalHtmlBg = html.style.backgroundColor;
    const originalTheme = html.dataset.mineoTheme;
    const pageBackground = '#f8f9fa';

    html.dataset.mineoTheme = 'light';
    html.style.backgroundColor = pageBackground;

    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = pageBackground;
    document.head.appendChild(meta);

    return () => {
      if (originalTheme === undefined) {
        html.removeAttribute('data-mineo-theme');
      } else {
        html.dataset.mineoTheme = originalTheme;
      }
      html.style.backgroundColor = originalHtmlBg;
      meta.remove();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#f8f9fa',
        color: 'rgba(0, 0, 0, 0.87)',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: '12px',
        lineHeight: 1.5,
        overflowY: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          minHeight: '100dvh',
          boxSizing: 'border-box',
          padding: '24px 16px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <UnsupportedDeviceTitle />

          <div
            style={{
              width: '100%',
              maxWidth: '1200px',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '10px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
              padding: '16px 12px',
              margin: '16px 0',
              boxSizing: 'border-box',
            }}
          >
            <p
              style={{
                color: 'rgba(0, 0, 0, 0.87)',
                fontSize: '15px',
                fontWeight: 500,
                lineHeight: 1.5,
                margin: '0 0 8px',
                padding: 0,
              }}
            >
              Desværre...
            </p>

            <div
              style={{
                color: 'rgba(0, 0, 0, 0.87)',
                fontSize: '12px',
                fontWeight: 400,
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: '0 0 8px' }}>
                Mineo er et komplekst program, der beregner erstatning
                i arbejdsskadesager.
              </p>

              <p style={{ margin: '0 0 8px' }}>
                Programmet laver omfattende beregninger i baggrunden, og
                er afhængig af inputs i tabeller samt muligheden for at
                gemme filer hos brugeren.
              </p>

              <p style={{ margin: '0 0 8px' }}>
                Derfor understøtter det ikke mobiltelefoner eller tablets og
                kan kun anvendes på en almindelig computer.
              </p>

              <p style={{ margin: 0 }}>
                Aktuel version: {VERSION}
              </p>
            </div>
          </div>

          <UnsupportedDeviceSiblingSites />
        </div>
      </div>
    </div>
  );
};

UnsupportedDevicePage.displayName = 'UnsupportedDevicePage';

export default UnsupportedDevicePage;

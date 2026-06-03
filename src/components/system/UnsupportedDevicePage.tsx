import React, { useEffect } from 'react';
import { VERSION } from '../../config/version';

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
          <h1
            style={{
              color: 'rgba(0, 0, 0, 0.87)',
              fontSize: '20px',
              fontWeight: 500,
              lineHeight: 1.4,
              margin: '0 0 16px',
              padding: 0,
            }}
          >
            Mineo
          </h1>

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
        </div>
      </div>
    </div>
  );
};

UnsupportedDevicePage.displayName = 'UnsupportedDevicePage';

export default UnsupportedDevicePage;

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
const UnsupportedDevicePage: React.FC = () => {
  useEffect(() => {
    const html = document.documentElement;
    const originalHtmlBg = html.style.backgroundColor;

    html.style.backgroundColor = '#f8f9fa';

    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#f8f9fa';
    document.head.appendChild(meta);

    return () => {
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
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '24px 16px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h1
            className="page-title"
            style={{ fontSize: '28px', marginBottom: '24px' }}
          >
            Mineo
          </h1>

          <div
            className="content-box"
            style={{
              width: '100%',
              maxWidth: '1200px',
              padding: '24px 16px',
              boxSizing: 'border-box',
            }}
          >
            <p
              className="section-header"
              style={{ fontSize: '16px', marginBottom: '16px' }}
            >
              Desværre...
            </p>

            <div className="body-text">
              <p style={{ marginTop: 0 }}>
                Mineo er et komplekst program, der beregner erstatning
                i arbejdsskadesager.
              </p>

              <p style={{ marginTop: '16px' }}>
                Programmet laver omfattende beregninger i baggrunden, og
                er afhængig af inputs i tabeller samt muligheden for at 
                gemme filer hos brugeren.
              </p>

              <p style={{ marginTop: '16px' }}>
                Derfor understøtter det ikke mobiltelefoner eller tablets og
                kan kun anvendes på en almindelig computer.
              </p>

              <p style={{ marginTop: '16px' }}>
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

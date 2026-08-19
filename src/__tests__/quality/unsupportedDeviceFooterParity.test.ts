import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Værn mod at hard-stop-sidens søskendeside-boks og den delte footers MOBILVISNING glider fra
 * hinanden.
 *
 * De to flader viser med vilje det samme for brugeren: mobilbrugeren, der får at vide at Mineo
 * kræver en computer, skal møde præcis den boks, de kender fra minProcesrente. Men de kan ikke
 * dele kode: `shell/unsupported-device-page-bundle-isolation` forbyder – af gode grunde –
 * hard-stop-siden at importere den MUI-byggede footer, så stylingen ER duplikeret, inline.
 *
 * Dubletten blev oprindeligt afleveret med prosaen «målt til at være geometrisk identisk». Den
 * påstand holdt ikke: tre af footerens mobile højdeerklæringer var aldrig kommet med over
 * (`.site-footer__link`s `minHeight: 28px` + `padding: 2px 0`, `.site-footer__mail`s
 * `minHeight: 39px`) og boksens nedre `margin` var halveret. Boksen blev 26 px lavere end
 * footerens, og linkrækkerne sad synligt tættere – netop det, brugeren så og påtalte.
 *
 * Lærestykket er, at en måling foretaget ÉN gang ikke er et værn. Denne test er værnet: den
 * læser de tal, der bærer geometrien, ud af BEGGE kilder og kræver, at de er de samme. En
 * ændring i footerens mobilvisning, der ikke følges op i dubletten, bliver rød her – i stedet
 * for at blive opdaget af en bruger, der kigger på to skærme.
 *
 * Testen låser bevidst kun de erklæringer, der bestemmer GEOMETRIEN (højder, padding, margin,
 * afstande, skriftstørrelser). Hover- og transition-regler er med vilje udenfor: de kræver
 * pseudoklasser, som en inline-styling ikke kan udtrykke, og de er uden betydning på en
 * touch-flade uden markør.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const footerPath = join(repoRoot, 'src', 'components', 'layout', 'SiblingSitesFooter.tsx');
const hardStopPath = join(repoRoot, 'src', 'components', 'system', 'UnsupportedDevicePage.tsx');

const footerSource = readFileSync(footerPath, 'utf8');
const hardStopSource = readFileSync(hardStopPath, 'utf8');

/**
 * Footerens mobilvisning bor i ét `@media (max-width: 640px)`-blok. Udsnittet tages fra
 * blokkens start til den næste `@media`-erklæring, så en desktopværdi ikke ved et uheld kan
 * læses som en mobilværdi.
 */
const footerMobileBlock = (): string => {
  const start = footerSource.indexOf("'@media (max-width: 640px)'");
  expect(start).toBeGreaterThan(-1);
  const rest = footerSource.slice(start);
  const end = rest.indexOf("'@media (max-width: 899px)'");
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
};

/** Erklæringer uden for mediablokken – de gælder også på mobil, medmindre blokken overskriver dem. */
const footerBaseBlock = (): string => footerSource.slice(0, footerSource.indexOf("'@media (max-width: 640px)'"));

const declaredPx = (source: string, selector: string, property: string): number => {
  const selectorIndex = source.indexOf(`'& ${selector}'`);
  expect(selectorIndex, `fandt ikke ${selector} i den forventede kilde`).toBeGreaterThan(-1);
  const block = source.slice(selectorIndex, source.indexOf('},', selectorIndex));
  const match = new RegExp(`${property}:\\s*'(-?\\d+(?:\\.\\d+)?)px'`).exec(block);
  expect(match, `fandt ikke ${property} på ${selector}`).not.toBeNull();
  return Number(match?.[1]);
};

const declaredShorthand = (source: string, selector: string, property: string): string => {
  const selectorIndex = source.indexOf(`'& ${selector}'`);
  expect(selectorIndex, `fandt ikke ${selector} i den forventede kilde`).toBeGreaterThan(-1);
  const block = source.slice(selectorIndex, source.indexOf('},', selectorIndex));
  const match = new RegExp(`${property}:\\s*'([^']+)'`).exec(block);
  expect(match, `fandt ikke ${property} på ${selector}`).not.toBeNull();
  return String(match?.[1]);
};

/** Værdien af én inline-egenskab i en navngiven styling-konstant på hard-stop-siden. */
const inlineValue = (constantName: string, property: string): string => {
  const start = hardStopSource.indexOf(`const ${constantName}`);
  expect(start, `fandt ikke ${constantName} på hard-stop-siden`).toBeGreaterThan(-1);
  const block = hardStopSource.slice(start, hardStopSource.indexOf('\n};', start));
  const match = new RegExp(`${property}:\\s*'([^']+)'`).exec(block);
  expect(match, `fandt ikke ${property} i ${constantName}`).not.toBeNull();
  return String(match?.[1]);
};

describe('unsupportedDeviceFooterParity', () => {
  describe('søskendelinkenes rækkegeometri', () => {
    it('holder linkets højde og lodrette padding identisk med footerens mobilvisning', () => {
      const mobile = footerMobileBlock();

      expect(inlineValue('siblingLinkStyle', 'minHeight'))
        .toBe(`${declaredPx(mobile, '.site-footer__link', 'minHeight')}px`);
      expect(inlineValue('siblingLinkStyle', 'padding'))
        .toBe(declaredShorthand(mobile, '.site-footer__link', 'padding'));
    });

    /**
     * Footeren arver MUI'ens globale `box-sizing: border-box`, så dens `minHeight: 28px` ER
     * rækkens ydre højde. Hard-stop-siden har intet stylesheet og dermed browserens
     * `content-box`, hvor de samme to erklæringer i stedet giver 28+2+2 = 32 px. Uden denne
     * ene erklæring er de to tal ens i kilden og alligevel fire pixel fra hinanden på skærmen.
     */
    it('sætter border-box eksplicit, fordi siden ikke arver MUI’ens reset', () => {
      expect(inlineValue('siblingLinkStyle', 'boxSizing')).toBe('border-box');
    });

    it('holder linkets skrift identisk med footerens', () => {
      const base = footerBaseBlock();

      expect(inlineValue('siblingLinkStyle', 'fontSize'))
        .toBe(`${declaredPx(base, '.site-footer__link', 'fontSize')}px`);

      // `lineHeight` er et tal (uden enhed) i begge kilder, så den læses uden citationstegn.
      const unitless = (source: string, selector: string): string => {
        const index = source.indexOf(`'& ${selector}'`);
        const block = source.slice(index, source.indexOf('},', index));
        return String(/lineHeight:\s*([\d.]+)/.exec(block)?.[1]);
      };
      const linkStart = hardStopSource.indexOf('const siblingLinkStyle');
      const linkBlock = hardStopSource.slice(linkStart, hardStopSource.indexOf('\n};', linkStart));

      expect(/lineHeight:\s*([\d.]+)/.exec(linkBlock)?.[1])
        .toBe(unitless(base, '.site-footer__link'));
    });

    it('holder afstanden mellem rækkerne og inden i en række identisk', () => {
      const mobile = footerMobileBlock();

      expect(inlineValue('siblingRowStyle', 'gap'))
        .toBe(declaredShorthand(mobile, '.site-footer__mobile-row', 'gap'));
      // Rækkeafstanden (`rowGap`) står på selve nav-elementet i begge kilder.
      expect(mobile).toContain("rowGap: '3px'");
      expect(hardStopSource).toContain("rowGap: '3px'");
    });

    it('holder prikseparatoren mellem to links identisk', () => {
      const mobile = footerMobileBlock();

      for (const property of ['width', 'height'] as const) {
        expect(inlineValue('siblingSeparatorStyle', property))
          .toBe(`${declaredPx(mobile, '.site-footer__mobile-sep', property)}px`);
      }
    });
  });

  describe('kontaktblokken', () => {
    it('holder mail-linkets minimumshøjde identisk med footerens', () => {
      const base = footerBaseBlock();
      const minHeight = declaredPx(base, '.site-footer__mail', 'minHeight');

      expect(hardStopSource).toContain(`minHeight: '${minHeight}px'`);
    });

    it('holder ikonets diameter identisk med footerens', () => {
      const base = footerBaseBlock();
      const size = declaredPx(base, '.site-footer__mail-icon', 'width');

      expect(size).toBe(declaredPx(base, '.site-footer__mail-icon', 'height'));
      expect(hardStopSource).toContain(`width: '${size}px'`);
      expect(hardStopSource).toContain(`height: '${size}px'`);
    });

    /**
     * Etiketten «KONTAKT» løftes én pixel i footeren, så den optisk flugter med adressen under.
     * Den slags finjustering er præcis det, en dublet taber først.
     */
    it('holder etikettens optiske løft identisk med footerens', () => {
      const base = footerBaseBlock();
      const transform = declaredShorthand(base, '.site-footer__mail-label', 'transform');

      expect(hardStopSource).toContain(`transform: '${transform}'`);
    });
  });

  describe('selve boksen', () => {
    /**
     * Footerens egne `marginTop: 40px` / `marginBottom: 0` er DESKTOPværdier. På mobil vinder
     * minProcesrente-sidens `& .content-box`-override med `margin: 16px 0`, og det er den
     * værdi, hard-stop-siden skal spejle – ikke footerkomponentens egen erklæring.
     */
    it('holder boksens margin identisk med den mobile .content-box, i begge ender', () => {
      const pagePath = join(
        repoRoot, 'src', 'components', 'pages', 'minprocesrente', 'MinProcesrenteCalculatorPage.tsx',
      );
      const pageSource = readFileSync(pagePath, 'utf8');
      const contentBoxIndex = pageSource.indexOf("'& .content-box'");
      expect(contentBoxIndex).toBeGreaterThan(-1);
      const block = pageSource.slice(contentBoxIndex, pageSource.indexOf('},', contentBoxIndex));

      const margin = /margin:\s*'([^']+)'/.exec(block)?.[1];
      const padding = /padding:\s*'([^']+)'/.exec(block)?.[1];

      expect(margin).toBe('16px 0');
      expect(padding).toBe('16px 12px');

      // Begge bokse på hard-stop-siden – indholdsboksen og søskendeboksen – bærer de samme tal.
      const occurrences = hardStopSource.match(/margin: '16px 0'/g) ?? [];
      expect(occurrences).toHaveLength(2);
      expect(hardStopSource.match(/padding: '16px 12px'/g) ?? []).toHaveLength(2);
    });
  });
});

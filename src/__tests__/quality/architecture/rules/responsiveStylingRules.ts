/**
 * Desktop-only-gatens styling-grænse (AGENTS.md «Desktop-only gate» + `app-shell-contract.md` §5.3).
 *
 * Mineo er desktop-only, og mobil/tablet-specifik styling hører derfor kun i
 * `UnsupportedDevicePage.tsx`. Standalone MinProcesrente er den ene bevidst mobil-tilladte variant.
 *
 * Reglen findes, fordi undtagelsen indtil nu kun stod som PROSA i kontrakten — og prosaen var
 * allerede drevet fra koden: §5.3 navngav to filer og kaldte stylingen «variant-lokal, ikke
 * delt», mens fem TS/TSX-filer i praksis bar den, heraf to DELT med Mineo. En undtagelse, ingen
 * håndhæver, breder sig lydløst; det er præcis den vej, en responsiv variant kan opstå uden for
 * den autoriserede unsupported-device-side.
 *
 * **Skæringen er bevidst per KATEGORI, ikke én flad liste**, fordi «nul hits» ellers ville dække
 * over tre forskellige begrundelser:
 *
 * 1. `VIEWPORT_RESPONSIVE_ALLOWLIST` — filer der må skifte LAYOUT efter viewport-bredde
 *    (`max-width`/`min-width`, MUI-breakpointnøgler). Det er den egentlige desktop-only-undtagelse,
 *    og listen er derfor kort og skal forblive det: standalone-egne filer plus de to flader, der
 *    er DELT mellem Mineo og standalone, hvor breakpointet betjener standalone-mobilbrugeren og
 *    aldrig tænder på desktop.
 * 2. Input-modalitet (`pointer: coarse`, `hover: hover`/`hover: none`) er IKKE responsivt layout.
 *    Det er en affordance efter inputenhed, som rammer touch-capable desktops — en klasse
 *    device-gaten bevidst slipper igennem. Den form er derfor tilladt overalt og skal ikke
 *    forurene viewport-allowlisten.
 *
 * En `isMobile`-PROP er heller ikke omfattet: den er en eksplicit parameter fra standalone-siden,
 * ikke en skjult responsiv regel, og den kan læses på callsitet.
 */
import { forbidImports, forbidTextPatterns } from '../ruleKit';

const sourceScope = {
  kind: 'scoped' as const,
  roots: ['src'],
  rationale: 'desktop-only-grænsen gælder hele den levende produktions-kildegraf',
};

/**
 * De ENESTE filer der må bære viewport-responsiv styling.
 *
 * Hver post skal kunne begrundes som enten standalone-lokal eller delt-med-standalone. Vokser
 * listen, er det en arkitekturbeslutning der skal afspejles i `app-shell-contract.md` §5.3 —
 * ikke en stiltiende tilføjelse. Anti-rot-kontrollen i harnesset fjerner omvendt en post, der
 * ikke længere udløser reglen, så listen ikke kan overleve sit eget mål.
 */
export const VIEWPORT_RESPONSIVE_ALLOWLIST: readonly string[] = [
  // Standalone-lokale filer (kun importeret/renderet af standalone-buildet).
  'src/components/pages/minprocesrente/MinProcesrenteCalculatorPage.tsx',
  'src/components/layout/StandaloneCalculatorLayout.tsx',
  // Delt mellem Mineo og standalone. Breakpointet betjener standalone-mobilbrugeren; på desktop
  // tænder det aldrig, så Mineos flade er upåvirket.
  'src/components/layout/SiblingSitesFooter.tsx',
  'src/components/pages/renteberegning/RenteberegningTab.tsx',
  // Mineo-lokal, men bevidst: device-gaten kræver TOUCH-lighed, så et smalt ikke-touch
  // desktopvindue slipper igennem. Reglen flytter kun knappen tættere på hjørnet dér — den
  // indfører ingen mobil-variant af siden.
  'src/components/ui/ScrollToTopButton.tsx',
];

/**
 * `src/apps/minprocesrente/minprocesrente.css` bærer også standalone-lokal `@media`-styling, men
 * kan IKKE stå i allowlisten: kilde-grafen indeholder kun `.ts`/`.tsx`. Reglen kan derfor ikke
 * udtale sig om CSS-filer, og fraværet af en post er ikke en stiltiende undtagelse.
 * `app-shell-contract.md` §5.3 er fortsat det sted, den fil er auditeret.
 *
 * `UnsupportedDevicePage.tsx` står heller ikke på listen — den bruger flydende bredder og
 * INGEN breakpoints. Stod den der, ville anti-rot-kontrollen med rette kalde posten forældet.
 */

/** Kommentarer er ikke styling — en forklarende `@media`-omtale må ikke gøre reglen rød. */
const stripComments = (text: string): string => text
  .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

export const viewportResponsiveStylingRule = forbidTextPatterns({
  id: 'shell/viewport-responsive-styling-allowlist',
  description:
    'Viewport-responsiv styling (@media max/min-width eller -height, MUI-breakpointnøgler) må kun findes i unsupported-device-siden, standalone-egne filer og de flader der bevidst deles med standalone.',
  liveTarget: sourceScope,
  allow: VIEWPORT_RESPONSIVE_ALLOWLIST,
  normalizeText: stripComments,
  patterns: [
    {
      pattern: /@media[^{'"`]*\((?:max|min)-(?:width|height)\s*:/,
      message:
        'Viewport-responsiv @media uden for desktop-only-undtagelsen — Mineo er desktop-only (AGENTS.md «Desktop-only gate»). Er filen delt med standalone MinProcesrente, skal den optages i VIEWPORT_RESPONSIVE_ALLOWLIST og i app-shell-contract.md §5.3.',
    },
    {
      pattern: /\b(?:xs|sm|md|lg|xl)\s*:\s*(?:'|"|`|\d)/,
      message:
        'MUI-breakpointnøgle uden for desktop-only-undtagelsen — brug en fast desktop-værdi, eller optag filen i VIEWPORT_RESPONSIVE_ALLOWLIST og i app-shell-contract.md §5.3.',
    },
    {
      pattern: /theme\.breakpoints\.(?:up|down|between|only)\s*\(/,
      message:
        'theme.breakpoints uden for desktop-only-undtagelsen — Mineo har ét desktop-layout; en breakpoint-forespørgsel her er en skjult responsiv variant.',
    },
  ],
  violatingFixtures: [
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const sx = { '@media (max-width: 640px)': { display: 'none' } };",
    },
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const sx = { '@media (max-height: 640px)': { display: 'none' } };",
    },
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const sx = { padding: { xs: '8px', md: '24px' } };",
    },
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));",
    },
  ],
  cleanFixtures: [
    // Input-modalitet er ikke responsivt layout og skal forblive tilladt overalt.
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const sx = { '@media (pointer: coarse)': { display: 'none' } };",
    },
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const sx = { '@media (hover: hover)': { '&:hover': { opacity: 1 } } };",
    },
    // En eksplicit prop fra standalone-siden er en læsbar parameter, ikke en skjult regel.
    {
      relativePath: 'src/components/pages/x.tsx',
      code: "const sx = { fontSize: isMobile ? '12px' : '14px' };",
    },
    // Kommentarer der OMTALER responsiv styling må ikke fælde reglen.
    {
      relativePath: 'src/components/pages/x.tsx',
      code: '// Bemærk: @media (max-width: 640px) håndteres af standalone-varianten.\nconst sx = { padding: 8 };',
    },
    { relativePath: 'src/components/pages/x.tsx', code: "const sx = { padding: '24px 16px' };" },
  ],
});

/**
 * Hard-stop-sidens bundle-isolation.
 *
 * `UnsupportedDevicePage` er det FØRSTE en mobilbruger downloader — og det eneste, de nogensinde
 * får, fordi Mineo stopper dér. Bootstrap-stien renderer den bevidst uden app-stylesheet og uden
 * MUI-tema (`apps/shared/bootstrapClientApp.tsx` henter kun to Montserrat-vægte på den vej).
 * Al styling på siden er derfor inline.
 *
 * Reglen findes, fordi isolationen indtil nu kun stod som PROSA i en kommentar på selve siden —
 * og prosa holder ikke: da søskendeside-boksen skulle genbruges fra `SiblingSitesFooter`, var den
 * nærliggende «genbrug» netop at importere den delte footer. Det ville have trukket hele
 * `@mui/material` ind i mobilens entry-chunk for at vise fire links, og siden ville oven i købet
 * rendere ustylet, fordi hverken `.content-box` eller `--color-*`-variablerne er indlæst.
 *
 * Grænsen er derfor: hard-stop-siden må importere RENE DATA-moduler (fx `layout/siblingSites.ts`),
 * men ikke UI-biblioteker eller app-shellens komponenter. Det er præcis den skelnen, der gør
 * dataen delelig uden at gøre stylingen delt.
 */
const UNSUPPORTED_DEVICE_PAGE = 'src/components/system/UnsupportedDevicePage.tsx';

/**
 * Mønstrene matcher RELATIVE specifiers (`../layout/SiblingSitesFooter`), ikke kun rod-relative
 * stier — hard-stop-siden importerer altid relativt, så en `components/…`-præfiksmatch ville
 * være inert. Harnessets fixture-selvtest fangede præcis den fejl.
 */
const FORBIDDEN_HARD_STOP_IMPORT_PATTERNS: readonly RegExp[] = [
  // UI-runtime: ville følge med ind i mobilens entry-chunk.
  /^@mui\//,
  /^@emotion\//,
  // App-shellens delte UI-komponenter — de forudsætter tema og/eller stylesheet.
  /(^|\/)(?:components\/)?ui\//,
  /(^|\/)SiblingSitesFooter$/,
  /(^|\/)contexts\//,
  // Stylesheets: hard-stop-siden har bevidst ingen.
  /(^|\/)styles\//,
  /\.css$/,
];

export const unsupportedDevicePageIsolationRule = forbidImports({
  id: 'shell/unsupported-device-page-bundle-isolation',
  description:
    'Hard-stop-siden for mobil/tablet må ikke importere MUI/Emotion eller app-shellens UI-komponenter — den renderes uden tema og uden stylesheet, og dens bundle er det eneste en mobilbruger henter.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === UNSUPPORTED_DEVICE_PAGE,
    rationale:
      'reglen forudsætter, at hard-stop-siden stadig findes som selvstændig fil på den isolerede bootstrap-sti',
    minimumMatches: 1,
    requiredPaths: [UNSUPPORTED_DEVICE_PAGE],
  },
  appliesTo: (relativePath) => relativePath === UNSUPPORTED_DEVICE_PAGE,
  forbidden: (ref) =>
    FORBIDDEN_HARD_STOP_IMPORT_PATTERNS.some((pattern) => pattern.test(ref.moduleSpecifier)),
  message: (ref) =>
    `Hard-stop-siden importerer \`${ref.moduleSpecifier}\`. Den renderes uden MUI-tema og uden app-stylesheet, `
    + 'så komponenten ville rendere ustylet — og importen ville trække UI-runtime ind i mobilens entry-chunk. '
    + 'Del DATA (fx layout/siblingSites.ts) og skriv stylingen inline.',
  violatingFixtures: [
    {
      relativePath: UNSUPPORTED_DEVICE_PAGE,
      code: "import { Box } from '@mui/material';",
    },
    {
      relativePath: UNSUPPORTED_DEVICE_PAGE,
      code: "import SiblingSitesFooter from '../layout/SiblingSitesFooter';",
    },
    {
      relativePath: UNSUPPORTED_DEVICE_PAGE,
      code: "import ExternalLink from '../ui/ExternalLink';",
    },
    {
      relativePath: UNSUPPORTED_DEVICE_PAGE,
      code: "import '../../styles/layout.css';",
    },
  ],
  cleanFixtures: [
    // Rene datamoduler er hele pointen: én kanonisk søskendeside-liste uden styling-afhængighed.
    {
      relativePath: UNSUPPORTED_DEVICE_PAGE,
      code: "import { SIBLING_SITES } from '../layout/siblingSites';",
    },
    {
      relativePath: UNSUPPORTED_DEVICE_PAGE,
      code: "import { VERSION } from '../../config/buildInfo';",
    },
    // Grænsen gælder KUN hard-stop-siden; app-shellens egne flader må bruge MUI frit.
    {
      relativePath: 'src/components/layout/SiblingSitesFooter.tsx',
      code: "import { Box } from '@mui/material';",
    },
  ],
});

export const RESPONSIVE_STYLING_RULES = [
  viewportResponsiveStylingRule,
  unsupportedDevicePageIsolationRule,
] as const;

/**
 * Den fælles policy for Mineos arbejdsflade- og sidemenuskalering.
 *
 * Modulet er den ene sandhedskilde for, hvor meget arbejdsfladen skal skaleres for at kunne være
 * i vinduet, og for de layoutmål, den beslutning bygger på. Både det synkrone head-script
 * (før første paint) og runtime-hooken læser herfra, så de to aldrig kan komme til at regne
 * forskelligt. Normativ beskrivelse: `src/contracts/app-shell-contract.md` §2.11.
 */
export const CONTENT_SCALE_CSS_VARIABLE = '--mineo-content-scale' as const;
export const CONTENT_SCALE_ROOT_SELECTOR = '[data-mineo-content-scale-root="true"]' as const;

export const SIDE_MENU_SCALE_POLICY = Object.freeze({
  fullWidthPx: 250,
  minimumWidthPx: 190,
  minimumContentScale: 0.78,
  fullContentGutterPx: 24,
  minimumContentGutterPx: 16,
  fullContentMainPaddingLeftPx: 50,
  minimumContentMainPaddingLeftPx: 25,
} as const);

/**
 * Bredden på `.content-box` — arbejdsfladens bredeste element på hver eneste side og fane.
 * Værdien er målt: intet indhold rager ud over indholdsboksen, så den er den ene bredde,
 * pladsregnskabet nedenfor skal kunne rumme.
 *
 * Spejler `--content-box-max-width` i `src/styles/layout.css`, som er den visuelle sandhedskilde.
 * `src/__tests__/quality/contentBoxWidthSingleSource.test.ts` fejler, hvis de to falder ud af sync.
 */
export const CONTENT_BOX_WIDTH_PX = 1200;

/**
 * Arbejdsfladens vandrette pladsregnskab.
 *
 * Mineo har et fast bredt layout: sidemenu + en indholdsflade, hvis bredde er den samme uanset
 * vinduet. Skalaen er den ene knap, der får det faste layout til at passe i vinduet — og
 * regnskabet er derfor delt i præcis to dele:
 *
 * - `unscaledLeftWidthPx`: alt til venstre for skillelinjen. Sidemenuen zoomer ikke med
 *   arbejdsfladen, og bredden regnes på den udfoldede menu ved fuld labelskala (værste tilfælde).
 *   En sammenfoldet eller lavere skaleret menu giver kun ekstra luft, aldrig beskæring.
 * - `scaledWorkspaceWidthPx`: alt til højre for skillelinjen. Både gutter, indrykning og
 *   indholdsboks ganges med skalaen, så afstanden mellem skillelinjen og teksten reduceres i
 *   samme takt som indholdet selv i stedet for at æde en voksende andel af et smalt vindue.
 *
 * Policyen er bevidst serialiserbar, fordi den samme konfiguration bruges af det synkrone
 * head-script og af runtime-hooken. Ingen del af policyen er brugerdata eller app-settings.
 */
export const CONTENT_UI_SCALE_POLICY = Object.freeze({
  maximumScale: 1,
  // Under dette trin bliver den mindste tekst på arbejdsfladen for lille til at læse. Så vidt ned
  // rækker skalaen — derunder overtager `Container`s vandrette scroll som den bevidste fallback.
  minimumScale: 0.75,
  // Skalaen kvantiseres til hele hundrededele. Det holder den deterministisk (samme vinduesbredde
  // giver altid samme skala) og gør trinnet så lille, at et skift ikke ses som et spring.
  scaleQuantumDivisor: 100,
  // Kvantiseringen sker på et flydende tal. Uden en lille tolerance kunne en bredde, der præcis
  // svarer til et trin, lande et hundrededel under det på grund af binær afrunding.
  quantizationEpsilon: 1e-9,
  unscaledLeftWidthPx: SIDE_MENU_SCALE_POLICY.fullWidthPx,
  // Venstre gutter + indrykning + indholdsboks + højre gutter. Begge gutters regnes med, så
  // indholdet aldrig fitter ved at ligge klods op ad scrollbaren i højre side.
  scaledWorkspaceWidthPx: SIDE_MENU_SCALE_POLICY.fullContentGutterPx
    + SIDE_MENU_SCALE_POLICY.fullContentMainPaddingLeftPx
    + CONTENT_BOX_WIDTH_PX
    + SIDE_MENU_SCALE_POLICY.fullContentGutterPx,
  // Indholdsfladens lodrette scrollbar ligger inden for vinduet og skal derfor holdes fri.
  scrollbarReservePx: 20,
} as const);

/**
 * Et kvantiseret skalatrin mellem policyens minimum og 1. Typen er bevidst `number`: trinnene
 * udledes af vinduets bredde og er ikke en opregnelig mængde.
 */
export type ContentUiScale = number;

export const SIDE_MENU_COLLAPSED_ICON_POLICY = Object.freeze({
  sidebarWidthPx: 70,
  sidebarBorderWidthPx: 1,
  buttonSizePx: 44,
  iconSlotSizePx: 24,
  iconSizePx: 20,
  expandedGroupPaddingPx: 12,
} as const);

const resolveSideMenuScaleProgress = (menuContentScale: number): number => {
  const safeMenuContentScale = Number.isFinite(menuContentScale)
    ? Math.max(SIDE_MENU_SCALE_POLICY.minimumContentScale, Math.min(1, menuContentScale))
    : 1;

  return (
    safeMenuContentScale - SIDE_MENU_SCALE_POLICY.minimumContentScale
  ) / (1 - SIDE_MENU_SCALE_POLICY.minimumContentScale);
};

const interpolateSideMenuScale = (minimum: number, full: number, menuContentScale: number): number => (
  minimum + (full - minimum) * resolveSideMenuScaleProgress(menuContentScale)
);

/**
 * Alle sidemenuikoner — også hamburgeren — lever under den samme zoomede indholdsrod. Dermed
 * deler de visuel størrelse, ikonflade og vandret anker i begge menutilstande.
 */
export const getCollapsedSideMenuIconLayout = (menuContentScale = 1) => {
  const scale = Number.isFinite(menuContentScale)
    ? Math.max(SIDE_MENU_SCALE_POLICY.minimumContentScale, Math.min(1, menuContentScale))
    : 1;

  return {
    buttonSizePx: SIDE_MENU_COLLAPSED_ICON_POLICY.buttonSizePx * scale,
    iconSizePx: SIDE_MENU_COLLAPSED_ICON_POLICY.iconSizePx * scale,
    // Flex-contentet slutter før sidebarens 1px skillelinje. Uden at fratrække den blev udfoldede
    // ikoner forskudt en halv px til højre i forhold til de kollapsede ved delvis zoom.
    iconCenterPx: (
      SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarWidthPx
      - SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarBorderWidthPx
    ) / 2,
    // Den udfoldede knap lever under menuens zoom. Padding beregnes derfor i layout-px, så
    // ikonets visuelle midtpunkt altid ligger på samme akse som i den kollapsede ikonkolonne.
    expandedButtonPaddingLeftPx: (
      (
        SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarWidthPx
        - SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarBorderWidthPx
      ) / (2 * scale)
    ) - SIDE_MENU_COLLAPSED_ICON_POLICY.expandedGroupPaddingPx
      - SIDE_MENU_COLLAPSED_ICON_POLICY.iconSlotSizePx / 2,
    // Hamburgeren er med vilje ikon-only også i den udfoldede menu. Den skal derfor have en
    // kvadratisk hoverflade med ens luft omkring ikonet, men stadig dele de øvrige ikonernes akse.
    expandedSquareButtonMarginLeftPx: (
      (
        SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarWidthPx
        - SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarBorderWidthPx
      ) / (2 * scale)
    ) - SIDE_MENU_COLLAPSED_ICON_POLICY.expandedGroupPaddingPx
      - SIDE_MENU_COLLAPSED_ICON_POLICY.buttonSizePx / 2,
  };
};

/**
 * Den udfoldede sidemenu følger præcis samme forhold som dens labels: fuld labelstørrelse giver
 * 250 px, mens mindste labelstørrelse giver 190 px. Dermed reduceres menuen ikke forskudt af
 * teksten, men i takt med den lodrette zoom, der også former labels, ikoner og luft.
 */
export const getExpandedSideMenuWidth = (menuContentScale = 1): number => {
  return interpolateSideMenuScale(
    SIDE_MENU_SCALE_POLICY.minimumWidthPx,
    SIDE_MENU_SCALE_POLICY.fullWidthPx,
    menuContentScale,
  );
};

/**
 * Indholdsfladens ydre gutter: luften mellem skillelinjen og indholdet — og den tilsvarende luft
 * mellem indholdet og vinduets højre kant. Samme værdi i begge sider, så arbejdsfladen står
 * symmetrisk, og den følger menuens labels, så tom plads reduceres i samme takt som teksten.
 */
export const getContentGutterForMenuScale = (menuContentScale = 1): number => (
  interpolateSideMenuScale(
    SIDE_MENU_SCALE_POLICY.minimumContentGutterPx,
    SIDE_MENU_SCALE_POLICY.fullContentGutterPx,
    menuContentScale,
  )
);

/**
 * Gutteren hører til arbejdsfladen, men ligger uden for zoom-roden og skaleres derfor ikke af
 * `zoom`. Den ganges i stedet med skalavariablen i CSS, så afstanden mellem skillelinjen og
 * teksten reduceres i takt med indholdet i stedet for at æde en voksende andel af et smalt vindue.
 * Uden variablen (standalone-beregneren) falder udtrykket tilbage til den fulde gutter.
 */
export const getContentGutterCssForMenuScale = (menuContentScale = 1): string => (
  `calc(${getContentGutterForMenuScale(menuContentScale)}px * var(${CONTENT_SCALE_CSS_VARIABLE}, 1))`
);

/** Den indre startluft holder læsbar afstand til skillelinjen også ved mindste skala. */
export const getContentMainPaddingLeftForMenuScale = (menuContentScale = 1): number => (
  interpolateSideMenuScale(
    SIDE_MENU_SCALE_POLICY.minimumContentMainPaddingLeftPx,
    SIDE_MENU_SCALE_POLICY.fullContentMainPaddingLeftPx,
    menuContentScale,
  )
);

/** Den mindste vinduesbredde, hvor hele arbejdsfladen kan vises ubeskåret ved den givne skala. */
export const requiredViewportWidthForScale = (scale: ContentUiScale): number =>
  CONTENT_UI_SCALE_POLICY.unscaledLeftWidthPx
  + CONTENT_UI_SCALE_POLICY.scaledWorkspaceWidthPx * scale
  + CONTENT_UI_SCALE_POLICY.scrollbarReservePx;

/**
 * Den smalleste vinduesbredde, policyen dækker uden vandret scroll. Under den fastholdes
 * minimumsskalaen, og `Container`s vandrette scroll er den autoritative fallback.
 */
export const MINIMUM_COVERED_VIEWPORT_WIDTH_PX = requiredViewportWidthForScale(
  CONTENT_UI_SCALE_POLICY.minimumScale,
);

/**
 * Den største skala, hele arbejdsfladen kan vises i uden vandret rul — kvantiseret nedad til hele
 * hundrededele og klemt ind mellem policyens minimum og 1.
 *
 * Funktionen er ren og historieløs: samme vinduesbredde giver altid samme skala, uanset om vinduet
 * kom dertil ved at vokse eller skrumpe. Der er ingen hysterese, fordi skalaen ikke kan påvirke
 * `window.innerWidth` og derfor ikke kan svinge; kvantiseringen alene holder skiftene rolige.
 */
export const resolveContentUiScale = (innerWidth: number): ContentUiScale => {
  const safeWidth = Number.isFinite(innerWidth) ? Math.max(0, innerWidth) : 0;
  const exactFit = (
    safeWidth
    - CONTENT_UI_SCALE_POLICY.unscaledLeftWidthPx
    - CONTENT_UI_SCALE_POLICY.scrollbarReservePx
  ) / CONTENT_UI_SCALE_POLICY.scaledWorkspaceWidthPx;
  const quantized = Math.floor(
    exactFit * CONTENT_UI_SCALE_POLICY.scaleQuantumDivisor + CONTENT_UI_SCALE_POLICY.quantizationEpsilon,
  ) / CONTENT_UI_SCALE_POLICY.scaleQuantumDivisor;

  return Math.min(
    CONTENT_UI_SCALE_POLICY.maximumScale,
    Math.max(CONTENT_UI_SCALE_POLICY.minimumScale, quantized),
  );
};

/**
 * Kilde til det inline-script, der sætter skaleringen før første paint. Scriptet gentager
 * bevidst udregningen i `resolveContentUiScale`: det kører før bundlen er hentet og kan derfor
 * ikke importere den. `uiScale.test.ts` sammenholder de to for en række vinduesbredder.
 */
export const createContentUiScaleBootstrapSource = (): string => {
  const serializedPolicy = JSON.stringify(CONTENT_UI_SCALE_POLICY);

  return `var mineoContentScalePolicy = ${serializedPolicy};
var mineoContentScaleWidth = Number.isFinite(window.innerWidth) ? Math.max(0, window.innerWidth) : 0;
var mineoContentScaleExactFit = (mineoContentScaleWidth
  - mineoContentScalePolicy.unscaledLeftWidthPx
  - mineoContentScalePolicy.scrollbarReservePx) / mineoContentScalePolicy.scaledWorkspaceWidthPx;
var mineoContentScale = Math.min(
  mineoContentScalePolicy.maximumScale,
  Math.max(
    mineoContentScalePolicy.minimumScale,
    Math.floor(mineoContentScaleExactFit * mineoContentScalePolicy.scaleQuantumDivisor + mineoContentScalePolicy.quantizationEpsilon)
      / mineoContentScalePolicy.scaleQuantumDivisor
  )
);
document.documentElement.style.setProperty('${CONTENT_SCALE_CSS_VARIABLE}', String(mineoContentScale));`;
};

/**
 * Måler browserens faktiske geometri på skaleringsroden. jsdom og ugyldig geometri giver neutral
 * skala, så runtime- og testmiljøer ikke gætter ud fra policyværdien.
 */
export const measureContentUiScaleRoot = (root: HTMLElement | null): number => {
  if (root === null || typeof window === 'undefined' || /jsdom/i.test(window.navigator.userAgent)) return 1;

  const rectWidth = root.getBoundingClientRect().width;
  const layoutWidth = root.offsetWidth;
  if (!Number.isFinite(rectWidth) || !Number.isFinite(layoutWidth) || rectWidth <= 0 || layoutWidth <= 0) return 1;

  const scale = rectWidth / layoutWidth;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
};

/** Finder den nærmeste navngivne skaleringsrod for geometri, der ligger under den. */
export const measureNearestContentUiScale = (element: Element | null): number => {
  const root = element?.closest(CONTENT_SCALE_ROOT_SELECTOR);
  return root instanceof HTMLElement ? measureContentUiScaleRoot(root) : 1;
};

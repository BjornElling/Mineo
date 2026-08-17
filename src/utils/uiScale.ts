/**
 * Den fælles policy for Mineos arbejdsfladeskalering.
 *
 * Policyen er bevidst serialiserbar, fordi den samme konfiguration bruges af det synkrone
 * head-script og af runtime-hooken. Ingen del af policyen er brugerdata eller app-settings.
 */
export const CONTENT_SCALE_CSS_VARIABLE = '--mineo-content-scale' as const;
export const CONTENT_SCALE_ROOT_SELECTOR = '[data-mineo-content-scale-root="true"]' as const;

export const CONTENT_UI_SCALE_POLICY = Object.freeze({
  scaleSteps: Object.freeze([1, 0.95, 0.9, 0.85]),
  fixedLeftWidthPx: 274,
  fixedContentExtensionPx: 1250,
  scrollbarReservePx: 20,
  minimumViewportWidthPx: 1358,
  // En lille opadgående buffer hindrer gentagne skift, når vinduet ligger på en skalagrænse.
  // Nedskalering bruger ikke bufferen: beskæring skal fjernes straks.
  upscaleHysteresisPx: 16,
} as const);

export type ContentUiScale = typeof CONTENT_UI_SCALE_POLICY.scaleSteps[number];

export const SIDE_MENU_SCALE_POLICY = Object.freeze({
  fullWidthPx: 250,
  minimumWidthPx: 190,
  minimumContentScale: 0.78,
  fullContentScrollPaddingLeftPx: 24,
  minimumContentScrollPaddingLeftPx: 16,
  fullContentMainPaddingLeftPx: 50,
  minimumContentMainPaddingLeftPx: 25,
} as const);

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

/** Indholdsfladens venstregutter følger menuens labels, så tom plads reduceres i samme takt. */
export const getContentScrollPaddingLeftForMenuScale = (menuContentScale = 1): number => (
  interpolateSideMenuScale(
    SIDE_MENU_SCALE_POLICY.minimumContentScrollPaddingLeftPx,
    SIDE_MENU_SCALE_POLICY.fullContentScrollPaddingLeftPx,
    menuContentScale,
  )
);

/** Den indre startluft holder læsbar afstand til skillelinjen også ved mindste skala. */
export const getContentMainPaddingLeftForMenuScale = (menuContentScale = 1): number => (
  interpolateSideMenuScale(
    SIDE_MENU_SCALE_POLICY.minimumContentMainPaddingLeftPx,
    SIDE_MENU_SCALE_POLICY.fullContentMainPaddingLeftPx,
    menuContentScale,
  )
);

const isContentUiScale = (value: number): value is ContentUiScale =>
  CONTENT_UI_SCALE_POLICY.scaleSteps.some((step) => step === value);

export const requiredViewportWidthForScale = (scale: ContentUiScale): number =>
  CONTENT_UI_SCALE_POLICY.fixedLeftWidthPx
  + CONTENT_UI_SCALE_POLICY.fixedContentExtensionPx * scale
  + CONTENT_UI_SCALE_POLICY.scrollbarReservePx;

/**
 * Finder det største tilladte skalatrin. Ved resize opad må hysterese kun forsinke det større trin;
 * ved resize nedad vælger funktionen straks det trin, der igen kan være nødvendigt for at undgå klip.
 */
export const resolveContentUiScale = (
  innerWidth: number,
  previousScale?: ContentUiScale,
): ContentUiScale => {
  const safeWidth = Number.isFinite(innerWidth)
    ? Math.max(0, innerWidth)
    : CONTENT_UI_SCALE_POLICY.minimumViewportWidthPx;
  const targetScale = CONTENT_UI_SCALE_POLICY.scaleSteps.find((scale) =>
    requiredViewportWidthForScale(scale) <= safeWidth
  ) ?? CONTENT_UI_SCALE_POLICY.scaleSteps[CONTENT_UI_SCALE_POLICY.scaleSteps.length - 1];

  if (previousScale === undefined || !isContentUiScale(previousScale) || targetScale <= previousScale) {
    return targetScale;
  }

  return requiredViewportWidthForScale(targetScale) + CONTENT_UI_SCALE_POLICY.upscaleHysteresisPx <= safeWidth
    ? targetScale
    : previousScale;
};

/** Kilde til det inline-script, der sætter skaleringen før første paint. */
export const createContentUiScaleBootstrapSource = (): string => {
  const serializedPolicy = JSON.stringify(CONTENT_UI_SCALE_POLICY);

  return `var mineoContentScalePolicy = ${serializedPolicy};
var mineoContentScaleWidth = Number.isFinite(window.innerWidth)
  ? Math.max(0, window.innerWidth)
  : mineoContentScalePolicy.minimumViewportWidthPx;
var mineoContentScale = mineoContentScalePolicy.scaleSteps[mineoContentScalePolicy.scaleSteps.length - 1];
for (var mineoContentScaleIndex = 0; mineoContentScaleIndex < mineoContentScalePolicy.scaleSteps.length; mineoContentScaleIndex += 1) {
  var mineoContentScaleCandidate = mineoContentScalePolicy.scaleSteps[mineoContentScaleIndex];
  var mineoContentScaleRequiredWidth = mineoContentScalePolicy.fixedLeftWidthPx
    + mineoContentScalePolicy.fixedContentExtensionPx * mineoContentScaleCandidate
    + mineoContentScalePolicy.scrollbarReservePx;
  if (mineoContentScaleRequiredWidth <= mineoContentScaleWidth) {
    mineoContentScale = mineoContentScaleCandidate;
    break;
  }
}
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

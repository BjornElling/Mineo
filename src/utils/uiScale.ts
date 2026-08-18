/**
 * Den fælles policy for Mineos arbejdsflade- og sidemenuskalering.
 *
 * Modulet er den ene sandhedskilde for, hvor meget programfladen skal skaleres for at kunne være
 * i vinduet, og for de layoutmål, den beslutning bygger på. Både det synkrone head-script
 * (før første paint) og runtime-hooken læser herfra, så de to aldrig kan komme til at regne
 * forskelligt. Normativ beskrivelse: `src/contracts/app-shell-contract.md` §2.11.
 *
 * **Én skala for hele fladen.** Sidemenu, gutter, indrykning og indholdsboks skaleres alle med
 * `--mineo-content-scale`. Tidligere zoomede kun arbejdsfladen, mens sidemenuen fulgte sin egen
 * højdestyrede skala; det gav to forskellige tekststørrelser i samme billede (menulabels i 14 px
 * ved siden af brødtekst i 10,5 px) og et pladsregnskab, der reserverede fuld menubredde til en
 * menu, der reelt var smallere. Menuens højdestyrede skala findes stadig, men kun som et LOFT:
 * den kan gøre menuen mindre end arbejdsfladen, aldrig større.
 */
export const CONTENT_SCALE_CSS_VARIABLE = '--mineo-content-scale' as const;
export const CONTENT_SCALE_ROOT_SELECTOR = '[data-mineo-content-scale-root="true"]' as const;

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
 * Kontrolfanernes udhæng til højre for indholdsboksen — den ENE bevidste undtagelse fra
 * pladsregnskabet nedenfor.
 *
 * `SideTab` roteres 90° om venstre-bund og rager derfor sin egen HØJDE ud til højre for sin `left`.
 * Fanerne står på indholdsboksens kant (`left = CONTENT_BOX_WIDTH_PX`) og ligger dermed HELT uden
 * for boksen. De 48 px indgår bevidst IKKE i `scaledShellWidthPx`: fanerne er en valgfri
 * kontrolflade (Indstillinger → «Vis kontrolfaner»), og hele arbejdsfladen må ikke skaleres ned for
 * at gøre plads til dem. Er der plads i højregutteren, står de der; er der ikke, går de tavst ud
 * over arbejdsfladens synlige højrekant og bliver klippet væk. Klipningen er ikke et held:
 * `SideTabRail` måler den synlige højrekant og klipper der, så udhænget hverken kan give vandret
 * rul eller flytte noget andet. Normativt: `src/contracts/app-shell-contract.md` §2.11.
 */
export const SIDE_TAB_OVERHANG_PX = 48;

/**
 * Bredden på kontrolfanernes skinne, målt i skinnens EGEN (uzoomede) koordinatverden.
 *
 * Skinnen klipper vandret ved sin egen højrekant, og bredden er derfor det ene sted, der afgør,
 * hvor meget af udhænget der er synligt. Alle indgange er vinduets px (`getBoundingClientRect`,
 * `clientWidth`, `scrollLeft`), og resultatet divideres med arbejdsfladens skala, fordi skinnen
 * ligger inde i zoom-roden.
 *
 * `scrollLeft` lægges til skinnens venstrekant, så klipningen er den samme, uanset om brugeren har
 * rullet vandret: klipperkanten er arbejdsfladens synlige højrekant ved rul 0. Uden det ville et
 * vandret rul (fallbacken under den dækkede bredde) afsløre mere af fanen og dermed selv gøre
 * scrollområdet bredere.
 *
 * Bunden er indholdsboksens bredde: en smallere skinne kan aldrig vise mere (fanerne begynder
 * præcis ved boksens kant), og bunden holder resultatet meningsfuldt i miljøer uden layout (jsdom
 * måler nul), hvor fanerne så blot er fuldt klippet.
 */
export const resolveSideTabRailWidthPx = (geometry: {
  /** Skinnens venstrekant i vinduets koordinater. */
  readonly railLeftPx: number;
  /** Arbejdsfladens synlige højrekant — scrollportens kant uden den lodrette scrollbar. */
  readonly scrollportRightPx: number;
  /** Scrollportens aktuelle vandrette rul. */
  readonly scrollLeftPx: number;
  /** Arbejdsfladens skala, målt på zoom-roden. */
  readonly scale: number;
}): number => {
  const { railLeftPx, scrollportRightPx, scrollLeftPx, scale } = geometry;
  const isMeasurable = [railLeftPx, scrollportRightPx, scrollLeftPx, scale].every(Number.isFinite)
    && scale > 0;
  if (!isMeasurable) return CONTENT_BOX_WIDTH_PX;

  const visibleWidthPx = (scrollportRightPx - (railLeftPx + scrollLeftPx)) / scale;
  // Nedad-afrunding: en halv px for meget er en px vandret rul, en halv px for lidt er usynlig.
  return Math.max(CONTENT_BOX_WIDTH_PX, Math.floor(visibleWidthPx));
};

/**
 * Sidemenuens uskalerede grundmål. Alle værdier er dem, menuen har ved skala 1; den faktiske
 * geometri er værdien gange menuens skala.
 */
export const SIDE_MENU_LAYOUT_POLICY = Object.freeze({
  expandedWidthPx: 250,
  collapsedWidthPx: 70,
  borderWidthPx: 1,
  buttonSizePx: 44,
  iconSlotSizePx: 24,
  groupPaddingPx: 12,
  /**
   * Menuens egen højdestyrede bundgrænse. Under dette trin komprimeres menuen ikke yderligere;
   * eventuelt overskydende indhold fortsætter tavst uden for vinduet frem for at få en scrollbar.
   */
  minimumHeightFitScale: 0.78,
} as const);

/** Arbejdsfladens ydre luft — samme afstand hele vejen rundt om indholdet. */
const CONTENT_GUTTER_PX = 24;

/** Den indre startluft fra skillelinjen til indholdet. */
const CONTENT_INDENT_PX = 50;

/**
 * Programfladens vandrette pladsregnskab.
 *
 * Hele rækken fra vinduets venstre kant til indholdets højre kant skaleres under ét:
 * sidemenu + venstre gutter + indrykning + indholdsboks + højre gutter. Begge gutters regnes
 * med, så indholdet aldrig fitter ved at ligge klods op ad scrollbaren i højre side. Summen
 * udledes af de navngivne layoutmål, aldrig af et hardkodet tal.
 *
 * `SIDE_TAB_OVERHANG_PX` er bevidst IKKE et led i summen — se dens egen forklaring ovenfor.
 *
 * Policyen er bevidst serialiserbar, fordi den samme konfiguration bruges af det synkrone
 * head-script og af runtime-hooken. Ingen del af policyen er brugerdata eller app-settings.
 */
export const CONTENT_UI_SCALE_POLICY = Object.freeze({
  maximumScale: 1,
  // Under dette trin bliver den mindste tekst på fladen for lille til at læse. Så vidt ned
  // rækker skalaen — derunder overtager `Container`s vandrette scroll som den bevidste fallback.
  minimumScale: 0.75,
  // Skalaen kvantiseres til hele hundrededele. Det holder den deterministisk (samme vinduesbredde
  // giver altid samme skala) og gør trinnet så lille, at et skift ikke ses som et spring.
  scaleQuantumDivisor: 100,
  // Kvantiseringen sker på et flydende tal. Uden en lille tolerance kunne en bredde, der præcis
  // svarer til et trin, lande et hundrededel under det på grund af binær afrunding.
  quantizationEpsilon: 1e-9,
  contentGutterPx: CONTENT_GUTTER_PX,
  contentIndentPx: CONTENT_INDENT_PX,
  scaledShellWidthPx: SIDE_MENU_LAYOUT_POLICY.expandedWidthPx
    + CONTENT_GUTTER_PX
    + CONTENT_INDENT_PX
    + CONTENT_BOX_WIDTH_PX
    + CONTENT_GUTTER_PX,
  // Indholdsfladens lodrette scrollbar ligger inden for vinduet og skal derfor holdes fri.
  scrollbarReservePx: 20,
} as const);

/**
 * Et kvantiseret skalatrin mellem policyens minimum og 1. Typen er bevidst `number`: trinnene
 * udledes af vinduets bredde og er ikke en opregnelig mængde.
 */
export type ContentUiScale = number;

/**
 * Sidemenuens indbyrdes ikongeometri, målt i menuens EGEN (zoomede) koordinatverden.
 *
 * Hele menuen — ramme såvel som indhold — skaleres med samme faktor, så forholdene indbyrdes er
 * konstante. Værdierne er derfor rene tal uden skala-afhængighed; det var de ikke, dengang
 * rammen var uskaleret og indholdet zoomet, hvor hver enkelt indrykning måtte divideres med
 * skalaen for at ramme samme lodrette akse.
 */
export const getSideMenuIconLayout = () => {
  // Flex-contentet slutter før sidebarens 1px skillelinje. Uden at fratrække den bliver udfoldede
  // ikoner forskudt en halv px til højre i forhold til de kollapsede.
  const iconCenterPx = (
    SIDE_MENU_LAYOUT_POLICY.collapsedWidthPx - SIDE_MENU_LAYOUT_POLICY.borderWidthPx
  ) / 2;

  return {
    iconCenterPx,
    /** Indrykning på en label-knap, så dens ikon står på den kollapsede ikonkolonnes akse. */
    expandedButtonPaddingLeftPx: iconCenterPx
      - SIDE_MENU_LAYOUT_POLICY.groupPaddingPx
      - SIDE_MENU_LAYOUT_POLICY.iconSlotSizePx / 2,
    /**
     * Hamburgeren er med vilje ikon-only også i den udfoldede menu. Den skal derfor have en
     * kvadratisk hoverflade med ens luft omkring ikonet, men stadig dele de øvrige ikoners akse.
     */
    expandedSquareButtonMarginLeftPx: iconCenterPx
      - SIDE_MENU_LAYOUT_POLICY.groupPaddingPx
      - SIDE_MENU_LAYOUT_POLICY.buttonSizePx / 2,
  };
};

/** Sidemenuens bredde ved en given menuskala. Rammen skaleres i takt med sit indhold. */
export const getSideMenuWidth = (menuScale: number, isExpanded: boolean): number => (
  (isExpanded ? SIDE_MENU_LAYOUT_POLICY.expandedWidthPx : SIDE_MENU_LAYOUT_POLICY.collapsedWidthPx)
  * (Number.isFinite(menuScale) ? Math.max(0, menuScale) : 1)
);

/**
 * Menuens faktiske skala: den mindste af arbejdsfladens skala og menuens egen højdetilpasning.
 *
 * Menuen må gerne blive mindre end arbejdsfladen (lavt vindue), men aldrig større: en menu med
 * 14 px labels ved siden af 10,5 px brødtekst er den mest iøjnefaldende typografiske uensartethed,
 * fladen kan have.
 */
export const resolveSideMenuScale = (contentScale: number, heightFitScale: number): number => {
  const safeContent = Number.isFinite(contentScale) ? Math.min(1, Math.max(0, contentScale)) : 1;
  const safeHeightFit = Number.isFinite(heightFitScale) ? Math.min(1, Math.max(0, heightFitScale)) : 1;
  return Math.min(safeContent, safeHeightFit);
};

/**
 * Arbejdsfladens ydre gutter i CSS.
 *
 * Gutteren hører til arbejdsfladen, men ligger uden for zoom-roden og skaleres derfor ikke af
 * `zoom`. Den ganges i stedet med skalavariablen i CSS. Uden variablen (standalone-beregneren)
 * falder udtrykket tilbage til den fulde gutter.
 */
export const CONTENT_GUTTER_CSS =
  `calc(${CONTENT_UI_SCALE_POLICY.contentGutterPx}px * var(${CONTENT_SCALE_CSS_VARIABLE}, 1))` as const;

/** Den mindste vinduesbredde, hvor hele fladen kan vises ubeskåret ved den givne skala. */
export const requiredViewportWidthForScale = (scale: ContentUiScale): number =>
  CONTENT_UI_SCALE_POLICY.scaledShellWidthPx * scale
  + CONTENT_UI_SCALE_POLICY.scrollbarReservePx;

/**
 * Den smalleste vinduesbredde, policyen dækker uden vandret scroll. Under den fastholdes
 * minimumsskalaen, og `Container`s vandrette scroll er den autoritative fallback.
 */
export const MINIMUM_COVERED_VIEWPORT_WIDTH_PX = requiredViewportWidthForScale(
  CONTENT_UI_SCALE_POLICY.minimumScale,
);

/**
 * Den største skala, hele fladen kan vises i uden vandret rul — kvantiseret nedad til hele
 * hundrededele og klemt ind mellem policyens minimum og 1.
 *
 * Funktionen er ren og historieløs: samme vinduesbredde giver altid samme skala, uanset om vinduet
 * kom dertil ved at vokse eller skrumpe. Der er ingen hysterese, fordi skalaen ikke kan påvirke
 * `window.innerWidth` og derfor ikke kan svinge; kvantiseringen alene holder skiftene rolige.
 */
export const resolveContentUiScale = (innerWidth: number): ContentUiScale => {
  const safeWidth = Number.isFinite(innerWidth) ? Math.max(0, innerWidth) : 0;
  const exactFit = (
    safeWidth - CONTENT_UI_SCALE_POLICY.scrollbarReservePx
  ) / CONTENT_UI_SCALE_POLICY.scaledShellWidthPx;
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
  - mineoContentScalePolicy.scrollbarReservePx) / mineoContentScalePolicy.scaledShellWidthPx;
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

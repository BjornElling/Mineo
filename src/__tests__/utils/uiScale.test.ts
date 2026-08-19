// @vitest-environment jsdom
import { createThemeBootstrapScript } from '../../settings/themeBootstrap';
import {
  CONTENT_BOX_WIDTH_PX,
  CONTENT_GUTTER_CSS,
  CONTENT_SCALE_CSS_VARIABLE,
  CONTENT_UI_SCALE_POLICY,
  MINIMUM_COVERED_VIEWPORT_WIDTH_PX,
  SIDE_MENU_LAYOUT_POLICY,
  SIDE_TAB_OVERHANG_PX,
  getSideMenuIconLayout,
  getSideMenuWidth,
  measureContentUiScaleRoot,
  requiredViewportWidthForScale,
  resolveContentUiScale,
  resolveSideMenuScale,
  resolveSideTabRailWidthPx,
} from '../../utils/uiScale';

describe('uiScale', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    document.documentElement.style.removeProperty(CONTENT_SCALE_CSS_VARIABLE);
  });

  it.each([
    [2560, 1],
    [1920, 1],
    [1568, 1],
    [1567, 0.99],
    [1536, 0.97],
    [1366, 0.86],
    // 1920×1200-skærmen ved 150 % zoom. Hele fladen skal kunne være der uden vandret rul.
    [1280, 0.81],
    [1244, 0.79],
    [1181, 0.75],
    [1180, 0.75],
    [1000, 0.75],
  ] as const)('vælger den største skala der kan være i %d CSS-px', (width, expected) => {
    expect(resolveContentUiScale(width)).toBe(expected);
  });

  it.each([1920, 1568, 1536, 1440, 1366, 1300, 1280, 1244, 1181] as const)(
    'lader hele fladen være i vinduet ved %d CSS-px',
    (width) => {
      const scale = resolveContentUiScale(width);

      expect(requiredViewportWidthForScale(scale)).toBeLessThanOrEqual(width);
      // Skalaen er også den STØRSTE der kan være der: et hundrededel mere ville kræve et bredere vindue.
      if (scale < CONTENT_UI_SCALE_POLICY.maximumScale) {
        expect(requiredViewportWidthForScale(scale + 0.01)).toBeGreaterThan(width);
      }
    },
  );

  it('er historieløs: samme bredde giver samme skala uanset retningen vinduet kom fra', () => {
    const widths = [1600, 1400, 1280, 1400, 1600];
    const scales = widths.map((width) => resolveContentUiScale(width));

    expect(scales[0]).toBe(scales[4]);
    expect(scales[1]).toBe(scales[3]);
  });

  it('ganger den ydre gutter med arbejdsfladens skala i CSS', () => {
    expect(CONTENT_GUTTER_CSS).toBe(`calc(24px * var(${CONTENT_SCALE_CSS_VARIABLE}, 1))`);
  });

  it('regner hele fladen – sidemenu inklusive – som ét skaleret pladsregnskab', () => {
    expect(CONTENT_UI_SCALE_POLICY.scaledShellWidthPx).toBe(250 + 24 + 50 + 1200 + 24);
    expect(requiredViewportWidthForScale(1)).toBe(
      CONTENT_UI_SCALE_POLICY.scaledShellWidthPx + CONTENT_UI_SCALE_POLICY.scrollbarReservePx
    );
    expect(MINIMUM_COVERED_VIEWPORT_WIDTH_PX).toBe(1181);
    expect(resolveContentUiScale(MINIMUM_COVERED_VIEWPORT_WIDTH_PX)).toBe(CONTENT_UI_SCALE_POLICY.minimumScale);
  });

  it.each([
    [1, 250, 70],
    [0.89, 222.5, 62.3],
    [0.75, 187.5, 52.5],
  ] as const)('skalerer sidemenuens ramme proportionalt ved skala %s', (menuScale, expanded, collapsed) => {
    expect(getSideMenuWidth(menuScale, true)).toBeCloseTo(expanded, 10);
    expect(getSideMenuWidth(menuScale, false)).toBeCloseTo(collapsed, 10);
  });

  it.each([
    // Arbejdsfladen er mindst → menuen følger den, så teksterne står ens.
    [0.8, 1, 0.8],
    // Vinduets højde er mindst → menuen må gerne være mindre end arbejdsfladen.
    [1, 0.8, 0.8],
    [0.9, 0.85, 0.85],
    // Menuen bliver aldrig større end arbejdsfladen.
    [0.75, 1, 0.75],
  ] as const)('lader menuen følge den mindste af de to skalaer (%s, %s)', (contentScale, heightFit, expected) => {
    expect(resolveSideMenuScale(contentScale, heightFit)).toBeCloseTo(expected, 10);
  });

  it('forankrer kollapsede og udfoldede ikoner på samme akse uafhængigt af skala', () => {
    const layout = getSideMenuIconLayout();
    const axis = (SIDE_MENU_LAYOUT_POLICY.collapsedWidthPx - SIDE_MENU_LAYOUT_POLICY.borderWidthPx) / 2;

    expect(layout.iconCenterPx).toBe(axis);
    // Label-knappens ikon: gruppepadding + knappens venstre-padding + halvt ikonfelt = aksen.
    expect(
      SIDE_MENU_LAYOUT_POLICY.groupPaddingPx
      + layout.expandedButtonPaddingLeftPx
      + SIDE_MENU_LAYOUT_POLICY.iconSlotSizePx / 2,
    ).toBeCloseTo(axis, 10);
    // Hamburgeren er kvadratisk og centrerer sit ikon i knappen – samme akse.
    expect(
      SIDE_MENU_LAYOUT_POLICY.groupPaddingPx
      + layout.expandedSquareButtonMarginLeftPx
      + SIDE_MENU_LAYOUT_POLICY.buttonSizePx / 2,
    ).toBeCloseTo(axis, 10);
  });

  it.each([
    [1920, 1],
    [1536, 0.97],
    [1366, 0.86],
    [1280, 0.81],
    [1000, 0.75],
  ] as const)('bootstrap-scriptet matcher runtime-policyen ved %d CSS-px', (width, expected) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    new Function(createThemeBootstrapScript())();

    expect(document.documentElement.style.getPropertyValue(CONTENT_SCALE_CSS_VARIABLE)).toBe(String(expected));
    expect(expected).toBe(resolveContentUiScale(width));
  });

  describe('kontrolfanernes skinne', () => {
    // Skinnens bredde er den ENE beslutning om, hvor meget af fanernes udhæng der er synligt.
    // Geometrien herunder er arbejdsfladen ved skala 1: menu 250 + gutter 24 → skinnens venstrekant
    // ligger 274 px inde, og indholdsboksens kant (og dermed fanens `left`) 50 + 1200 px længere.
    const railLeftPx = 274 + 50;

    it('holder udhænget uden for pladsregnskabet', () => {
      // Værnet mod den nemmeste «rettelse»: at lægge udhænget ind i summen, så hele fladen skrumper
      // for at gøre plads til to valgfrie kontrolfaner.
      expect(CONTENT_UI_SCALE_POLICY.scaledShellWidthPx).toBe(250 + 24 + 50 + CONTENT_BOX_WIDTH_PX + 24);
      expect(SIDE_TAB_OVERHANG_PX).toBe(48);
    });

    it('måler den synlige bredde og omregner til skinnens egen koordinatverden', () => {
      // Fuld plads: hele udhænget er inden for den synlige kant.
      expect(resolveSideTabRailWidthPx({
        railLeftPx,
        scrollportRightPx: 1920,
        scrollLeftPx: 0,
        scale: 1,
      })).toBe(1920 - railLeftPx);

      // Ved skala 0,8 er den synlige bredde målt i vinduets px, men skinnen lever inde i zoom-roden.
      expect(resolveSideTabRailWidthPx({
        railLeftPx: 200,
        scrollportRightPx: 1400,
        scrollLeftPx: 0,
        scale: 0.8,
      })).toBe(1500);
    });

    it('klipper udhænget, når højregutteren ikke kan rumme det', () => {
      // Kanten ligger 20 px til højre for indholdsboksen → 20 af udhængets 48 px er synlige, og
      // resten forsvinder tavst. Det er hele designvalget: fanen skrumper ikke arbejdsfladen.
      const width = resolveSideTabRailWidthPx({
        railLeftPx: 0,
        scrollportRightPx: CONTENT_BOX_WIDTH_PX + 20,
        scrollLeftPx: 0,
        scale: 1,
      });

      expect(width).toBe(CONTENT_BOX_WIDTH_PX + 20);
      expect(width).toBeLessThan(CONTENT_BOX_WIDTH_PX + SIDE_TAB_OVERHANG_PX);
    });

    it('er upåvirket af vandret rul', () => {
      // Uden `scrollLeft` i regnestykket ville et rul mod højre afsløre mere af fanen – og dermed
      // selv gøre scrollområdet bredere, rul efter rul.
      const atRest = resolveSideTabRailWidthPx({
        railLeftPx,
        scrollportRightPx: 1500,
        scrollLeftPx: 0,
        scale: 1,
      });
      const scrolled = resolveSideTabRailWidthPx({
        railLeftPx: railLeftPx - 300,
        scrollportRightPx: 1500,
        scrollLeftPx: 300,
        scale: 1,
      });

      expect(scrolled).toBe(atRest);
    });

    it('falder tilbage til indholdsboksens bredde, når geometrien ikke kan måles', () => {
      // Bunden gør fanerne fuldt klippede frem for at lade en umålelig geometri (jsdom, skjult
      // flade, skala 0) give en tilfældig bredde – og den kan aldrig give vandret rul.
      for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolveSideTabRailWidthPx({
          railLeftPx,
          scrollportRightPx: 1920,
          scrollLeftPx: 0,
          scale,
        })).toBe(CONTENT_BOX_WIDTH_PX);
      }

      expect(resolveSideTabRailWidthPx({
        railLeftPx: 0,
        scrollportRightPx: 0,
        scrollLeftPx: 0,
        scale: 1,
      })).toBe(CONTENT_BOX_WIDTH_PX);
    });
  });

  it('returnerer neutral skala for jsdom og ugyldig geometri', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);

    expect(measureContentUiScaleRoot(root)).toBe(1);

    root.remove();
    expect(measureContentUiScaleRoot(null)).toBe(1);
  });
});

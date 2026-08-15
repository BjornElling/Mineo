// @vitest-environment jsdom
import {
  OVERLAY_ROOT_MARKER,
  __resetOverlayStackForTest,
  hasOpenOverlay,
  isInsideOverlay,
  isTopmostOverlay,
  openOverlayCount,
  popOverlay,
  pushOverlay,
} from '../../../components/ui/overlayBehavior';

// Overlay-stakken afgør, HVILKET overlay der ejer Escape og tilbage-knappen, når flere ligger oven
// på hinanden (fejlrapport-dialogen åbnes fra load-preflightens bekræftelse). Uden stakken ville
// begge lag lukke på ét tastetryk.

describe('overlay-stak: hvem ejer Escape og tilbage-knappen', () => {
  beforeEach(() => { __resetOverlayStackForTest(); });

  it('har intet øverste overlay, når intet er åbent', () => {
    expect(isTopmostOverlay('a')).toBe(false);
    expect(openOverlayCount()).toBe(0);
  });

  it('gør det ENESTE åbne overlay til det øverste', () => {
    pushOverlay('a');
    expect(isTopmostOverlay('a')).toBe(true);
  });

  it('lader det SENEST åbnede vinde over det underliggende', () => {
    // Kernen: to lag må ikke begge reagere på ét Escape.
    pushOverlay('preflight');
    pushOverlay('fejlrapport');

    expect(isTopmostOverlay('fejlrapport')).toBe(true);
    expect(isTopmostOverlay('preflight')).toBe(false);
  });

  it('giver ejerskabet TILBAGE til det underliggende, når det øverste lukkes', () => {
    pushOverlay('preflight');
    pushOverlay('fejlrapport');
    popOverlay('fejlrapport');

    expect(isTopmostOverlay('preflight')).toBe(true);
    expect(openOverlayCount()).toBe(1);
  });

  it('er robust over for en lukning i uventet rækkefølge', () => {
    // Et overlay kan unmountes, mens et andet ligger ovenpå — fx hvis den underliggende side
    // navigeres væk. Stakken må ikke efterlade en forkert ejer.
    pushOverlay('a');
    pushOverlay('b');
    popOverlay('a');

    expect(isTopmostOverlay('b')).toBe(true);
    expect(openOverlayCount()).toBe(1);
  });

  it('registrerer ikke det samme overlay to gange', () => {
    // En re-render må ikke lægge et ekstra lag på stakken; ellers ville der skulle to Escape til
    // at lukke ét vindue.
    pushOverlay('a');
    pushOverlay('a');

    expect(openOverlayCount()).toBe(1);
    popOverlay('a');
    expect(openOverlayCount()).toBe(0);
  });

  it('ignorerer en lukning af et overlay, der ikke er registreret', () => {
    pushOverlay('a');
    popOverlay('ukendt');
    expect(isTopmostOverlay('a')).toBe(true);
  });
});

describe('overlay-markøren: hvad Container aflæser', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('melder INTET åbent overlay på en almindelig side', () => {
    document.body.innerHTML = '<div><button>Felt</button></div>';
    expect(hasOpenOverlay()).toBe(false);
  });

  it('melder et åbent overlay, så snart en flade bærer markøren', () => {
    document.body.innerHTML = `<div ${OVERLAY_ROOT_MARKER}="true"><button>Luk</button></div>`;
    expect(hasOpenOverlay()).toBe(true);
  });

  it('genkender en node INDE i overlayet', () => {
    document.body.innerHTML = `<div ${OVERLAY_ROOT_MARKER}="true"><button id="inde">Luk</button></div>`;
    expect(isInsideOverlay(document.getElementById('inde'))).toBe(true);
  });

  it('genkender IKKE en node uden for overlayet', () => {
    document.body.innerHTML =
      `<div ${OVERLAY_ROOT_MARKER}="true"></div><button id="ude">Bagved</button>`;
    expect(isInsideOverlay(document.getElementById('ude'))).toBe(false);
  });

  it('er tavs for ikke-elementer', () => {
    expect(isInsideOverlay(null)).toBe(false);
    expect(isInsideOverlay('ikke et element')).toBe(false);
  });

  it('reagerer IKKE på et rå role="dialog" uden markøren', () => {
    // Markøren er en eksplicit erklæring, ikke en udledning af ARIA-rollen. Rollen bæres også af
    // flader, der ikke er modale, og af tredjeparts-widgets.
    document.body.innerHTML = '<div role="dialog"><button>Luk</button></div>';
    expect(hasOpenOverlay()).toBe(false);
  });
});

/**
 * Programmets ENE regelsæt for overlays: hvad et overlay ER, hvordan tastaturet opfører sig i det,
 * og hvordan det lukkes.
 *
 * **Hvorfor modulet findes.** Der fandtes seks overlay-flader og lige så mange delvise løsninger:
 *
 *  - `ConfirmationDialog`, fejlrapport-dialogerne og `ErrorFallback` er MUI-`Dialog`s, der PORTALERER
 *    ud af `<main>`. De arver MUI's fokusfangst og lukker på Escape og backdrop.
 *  - `LicenseModal` og `LoentrinFinderOverlay` er HÅNDRULLEDE og renderes INLINE i sidens DOM.
 *
 * Den forskel var ikke et designvalg – den var afgørende, og det var tilfældigt. `Container` ejer Tab
 * for hele siden, og dens ENESTE undtagelse er, at hændelsen kommer fra uden for dens DOM-subtræ:
 *
 *     if (targetNode && !container.contains(targetNode)) return;
 *
 * En portaleret dialog ligger under `document.body` og slipper derfor igennem. Et inline-overlay er en
 * ægte DOM-efterkommer og gør IKKE. `Container` overtog dermed Tab inde i licensvinduet og førte fokus
 * ud i siden bagved – selv om vinduet havde en korrekt monteret `FocusTrap`. Målt i chrome-desktop:
 * otte Tab i træk landede alle uden for dialogen. `LoentrinFinderOverlay` undslap kun, fordi den har en
 * capture-fase-lytter med sin egen hardkodede tab-sekvens, altså en TREDJE mekanisme.
 *
 * Konklusionen er, at «er dette et åbent overlay?» ikke må udledes af, hvor komponenten tilfældigvis
 * er monteret i DOM'en. Det skal være noget overlayet SIGER. Derfor dette modul.
 *
 * Modulet ejer ingen React-tilstand og ingen præsentation – kun markøren, registret og de rene
 * beslutninger. React-siden bor i `useOverlayBehavior`.
 */

/**
 * Markøren, et overlay sætter på sin rod-node. Samme mønster som
 * {@link ../../inputCore/react/modalFocusTransfer!CONFIRMATION_DIALOG_FOCUS_MARKER}, men for ENHVER
 * overlay-flade – ikke kun bekræftelsesdialogen.
 *
 * En markør frem for et opslag på `role="dialog"`: rollen bæres også af flader, der ikke er modale
 * (og af tredjeparts-widgets), mens markøren er en eksplicit erklæring fra den flade, der ved, at den
 * er et overlay.
 */
export const OVERLAY_ROOT_MARKER = 'data-mineo-overlay-root';

const OVERLAY_ROOT_SELECTOR = `[${OVERLAY_ROOT_MARKER}="true"]`;

/**
 * Er noden inde i et overlay?
 *
 * Bruges af `Container`s tastaturnavigation til at holde fingrene væk. Bemærk, at det IKKE er nok at
 * spørge om DOM-indeslutning i det aktuelle overlay: et inline-overlay er en efterkommer af
 * containeren, så containeren skal aktivt vide, at den skal lade være.
 */
export const isInsideOverlay = (node: unknown): boolean => {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return false;
  return node.closest(OVERLAY_ROOT_SELECTOR) !== null;
};

/**
 * Er der overhovedet et overlay åbent lige nu?
 *
 * `Container` skal give slip på Tab, så snart et overlay er åbent – ikke kun når hændelsen tilfældigvis
 * starter inde i overlayet. Uden dette kunne et Tab, der starter på et element BAG overlayet (fx efter
 * et klik, der ikke flyttede fokus), stadig drive sidens navigation videre under et modalt vindue.
 */
export const hasOpenOverlay = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.querySelector(OVERLAY_ROOT_SELECTOR) !== null;
};

/**
 * Lukkeveje, ethvert overlay skal understøtte.
 *
 * Listen er kontrakten, ikke en anbefaling: en flade må ikke selv vælge en delmængde. Før havde hver
 * overlay sin egen kombination – licensvinduet manglede tilbage-knappen, fejlrapport-dialogerne
 * manglede den også, og fejl-toasten havde hverken Escape eller en lukkeknap.
 */
export type OverlayCloseCause = 'escape' | 'backdrop' | 'close-button' | 'history-back';

/**
 * Overlay-stakken. Nødvendig, fordi overlays kan ligge oven på hinanden – fejlrapport-dialogen åbnes
 * fra load-preflightens `ConfirmationDialog`.
 *
 * Kun det ØVERSTE overlay må reagere på Escape og på tilbage-knappen. Uden en stak ville begge lag
 * lukke på ét tastetryk, og brugeren ville miste den underliggende dialog uden at have bedt om det.
 * Registret er modulglobalt, fordi der findes præcis ét dokument og dermed én stak.
 */
const overlayStack: string[] = [];

/** Registrér et åbnet overlay og få dets plads i stakken. Kald `popOverlay` ved lukning. */
export const pushOverlay = (id: string): void => {
  if (!overlayStack.includes(id)) overlayStack.push(id);
};

export const popOverlay = (id: string): void => {
  const index = overlayStack.lastIndexOf(id);
  if (index !== -1) overlayStack.splice(index, 1);
};

/** Er dette overlay det øverste – og dermed det, der ejer Escape og tilbage-knappen? */
export const isTopmostOverlay = (id: string): boolean =>
  overlayStack.length > 0 && overlayStack[overlayStack.length - 1] === id;

/** Antal åbne overlays. Kun til test og diagnostik. */
export const openOverlayCount = (): number => overlayStack.length;

/** Nulstiller stakken. KUN til test – produktion afmelder gennem `popOverlay`. */
export const __resetOverlayStackForTest = (): void => {
  overlayStack.length = 0;
};

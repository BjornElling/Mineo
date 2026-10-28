/**
 * Togglens afvisningsrystelse – svaret på et klik, som en toggle ikke vil udføre.
 *
 * En toggle er en tilstandskontrol: brugeren klikker og forventer, at knoppen flytter sig. Bliver den
 * stående – fordi en gate afviser ændringen, eller fordi togglen er inaktiv – ligner det ellers et klik,
 * der ikke blev registreret. Rystelsen er det fysiske «nej»: knoppen prøver at flytte sig og bliver
 * stående (udviklerbeslutning 2026-10-28, som genindfører animationen fra før 2026-08-15 uændret).
 *
 * Reglen gælder KUN toggles. Grå knapper svarer fortsat tavst på et klik (page-component-contract §11.1a):
 * en knap har ingen tilstand, der kunne have flyttet sig, og dens tooltip forklarer allerede blokeringen.
 *
 * Ligesom `fieldAttentionBlink` er rystelsen en ren DOM-effekt frem for React-state. Det er det, der lader
 * et gentaget klik genstarte animationen: en boolsk state, der allerede er sand, ville React bail'e ud af,
 * og brugeren fik intet svar på andet klik inden for animationens løbetid.
 */

/** CSS-klassen, der bærer animationen. Defineret ét sted i `sharedApp.css`. */
export const TOGGLE_REFUSAL_SHAKE_CLASS = 'mineo-toggle-refusal-shake';

/** Skal matche animationens løbetid i `sharedApp.css` (0,5 s × 1 gennemløb). */
export const TOGGLE_REFUSAL_SHAKE_DURATION_MS = 500;

const pendingClears = new WeakMap<HTMLElement, number>();

/**
 * Lad en toggle ryste. Kaldes med switchens rodelement (`.MuiSwitch-root`), så kun selve kontakten
 * bevæger sig – ikke en tilknyttet label.
 */
export const shakeRefusedToggle = (element: HTMLElement | null | undefined): void => {
  if (!element || typeof window === 'undefined') return;

  const existingTimer = pendingClears.get(element);
  if (existingTimer !== undefined) {
    window.clearTimeout(existingTimer);
    pendingClears.delete(element);
  }

  // Genstart animationen: fjern klassen, tving reflow, sæt den igen.
  element.classList.remove(TOGGLE_REFUSAL_SHAKE_CLASS);
  void element.offsetWidth;
  element.classList.add(TOGGLE_REFUSAL_SHAKE_CLASS);

  const timer = window.setTimeout(() => {
    element.classList.remove(TOGGLE_REFUSAL_SHAKE_CLASS);
    pendingClears.delete(element);
  }, TOGGLE_REFUSAL_SHAKE_DURATION_MS);
  pendingClears.set(element, timer);
};

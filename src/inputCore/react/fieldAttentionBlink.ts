/**
 * Den DELTE «peg på dette felt»-blinkmarkering (BF-020/BF-021).
 *
 * Programmet har tre veje, der fører brugeren hen til en indtastning, som kræver opmærksomhed:
 * undo/redo-fokusrestoren, save-blokeringens fokus og de interne fejl-/advarselslinks. Alle tre
 * lokaliserer målet gennem den ENE feltidentitet i DOM (`data-mineo-field-address`, §3.2) — men kun
 * Årslønssidens løntabel havde en visuel markering, og den var privat for netop den tabel: en lokal
 * `flashCell`-state, et lokalt `@keyframes errorFlash` og et cellekoordinat (`rowId` + `colIdx`), som
 * ingen anden flade kan tale.
 *
 * Her er markeringen løftet ud til ét sted, og den er gjort til en ren DOM-effekt frem for React-state.
 * Det er DET valg, der gør den generelt tilgængelig: markeringen kan lægges på ethvert element, en
 * feltadresse peger på, uden at feltkomponenten skal kende til den, holde state eller opte ind. Et nyt
 * felt eller en ny tabel arver blinkmarkeringen alene ved at bære feltadressen, som surfacen allerede
 * sætter.
 *
 * Markeringen er RENT visuel: den ændrer ingen værdi, sætter ingen feltfejl (§1.7) og blokerer intet.
 * Den siger «her» — ikke «dette er forkert». Derfor bruges den både til ægte fejl og til en manglende
 * indtastning, der endnu ikke er en fejl.
 */

import { FIELD_ADDRESS_ATTR } from './historyRestoreTarget';

/** CSS-klassen, der bærer selve animationen. Defineret ét sted i `sharedApp.css`. */
export const FIELD_ATTENTION_BLINK_CLASS = 'mineo-field-attention-blink';

/**
 * Hvor længe markeringen står. Skal matche animationens samlede løbetid i `sharedApp.css`
 * (0,5 s × 3 gennemløb), så klassen fjernes, når animationen faktisk er slut — ikke før, hvor den ville
 * blive klippet af, og ikke længe efter, hvor et nyt blink på samme element ville blive slugt.
 */
export const FIELD_ATTENTION_BLINK_DURATION_MS = 1500;

/** Timeren pr. element, så gentagne blink på samme element ikke efterlader en forældet oprydning. */
const pendingClears = new WeakMap<HTMLElement, number>();

/**
 * Lad et element blinke for at pege brugeren på det.
 *
 * Kaldes med det element, opslaget allerede har fundet — modulet slår ikke selv op og navigerer ikke.
 * Ansvarsdelingen er bevidst: navigation og «hvilket felt» ejes af de eksisterende fokusveje
 * (`lookupEditorLocation`, `findRestoreTarget`), mens dette modul kun ejer det visuelle svar.
 *
 * Et blink på et element, der allerede blinker, starter forfra: animationen fjernes, layoutet tvinges
 * frem (`offsetWidth`), og klassen sættes igen. Uden genstarten ville et gentaget klik på samme link
 * ikke give nogen synlig reaktion, fordi klassen allerede stod der.
 */
export const blinkFieldAttention = (element: HTMLElement | null | undefined): void => {
  if (!element || typeof window === 'undefined') return;

  const existingTimer = pendingClears.get(element);
  if (existingTimer !== undefined) {
    window.clearTimeout(existingTimer);
    pendingClears.delete(element);
  }

  // Genstart animationen: fjern klassen, tving reflow, sæt den igen.
  element.classList.remove(FIELD_ATTENTION_BLINK_CLASS);
  void element.offsetWidth;
  element.classList.add(FIELD_ATTENTION_BLINK_CLASS);

  const timer = window.setTimeout(() => {
    element.classList.remove(FIELD_ATTENTION_BLINK_CLASS);
    pendingClears.delete(element);
  }, FIELD_ATTENTION_BLINK_DURATION_MS);
  pendingClears.set(element, timer);
};

/**
 * Blink det element, der bærer en given serialiseret feltadresse — uanset hvilken flade det hører til.
 *
 * Bruges af de fokusveje, der har adressen men ikke elementet. Findes flere spejlede editorer for samme
 * felt, blinker den FØRSTE i dokumentrækkefølge; det er samme vilkårlige-men-entydige valg, som
 * `lookupEditorLocation` træffer, og enhver af dem er en gyldig flade for feltet.
 *
 * @returns true hvis et element blev fundet og markeret.
 */
export const blinkFieldAttentionByAddress = (serializedAddress: string): boolean => {
  if (typeof document === 'undefined') return false;
  const element = document.querySelector(
    `[${FIELD_ADDRESS_ATTR}=${JSON.stringify(serializedAddress)}]`
  );
  if (!(element instanceof HTMLElement)) return false;
  blinkFieldAttention(element);
  return true;
};

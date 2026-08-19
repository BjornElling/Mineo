import React from 'react';
import { focusElementWithoutScroll } from '../utils/focusUtils';

/**
 * Den ENE fokus-restore-vej for popup-flader (jf. `keyboard-navigation.md` §Popup-fokus-restore).
 *
 * Regel: når en popup lukkes, skal fokus tilbage til den kontrol, brugeren åbnede den med.
 * Hver popup har præcis én åbnende kontrol, så målet er entydigt og behøver ingen heuristik.
 *
 * Hvorfor hooken findes frem for et `element.focus()` pr. popup: den naive form virker ikke.
 * Tre konkrete forhold gjorde tidligere hver sin popup til sin egen løsning – eller til ingen:
 *
 * 1. **WebKit fokuserer ikke `<button>` ved klik.** Der er derfor intet `document.activeElement`
 *    at huske ved åbning, og en restore baseret alene på «hvad var aktivt» lander på sidens
 *    første fokusbare element. Derfor er den eksplicitte `triggerRef` den primære kilde, og det
 *    huskede aktive element kun et fallback for kontroller, der ikke fører en ref.
 * 2. **Fokus er ikke nødvendigvis tabt på `body`.** WebKit flytter ved Escape fokus til dialogens
 *    egen container, som først forsvinder ved unmount af portalen. Et frakoblet eller stadig
 *    popup-ejet element tæller derfor som «fokus er tabt», præcis som `body` gør.
 * 3. **Lukningen er ikke ét tidspunkt.** MUI's transition slutter FØR portalen er unmountet, og
 *    WebKit nulstiller fokus til `body`, når den fokuserede popup-node forsvinder – altså EFTER
 *    vores genoprettelse. Derfor efterses restoren én gang på næste frame.
 * 4. **MUI genopretter selv fokus.** En `Dialog` fører sin egen restore til det element, der var
 *    aktivt ved åbningen, og den kører SIDST – så den overskriver vores mål, uden at noget fejler.
 *    En popup bygget på MUI skal derfor sætte `disableRestoreFocus` (se `ConfirmationDialog`), ellers
 *    er der to restore-veje, og den, der ikke kender kontraktens målprioritet, vinder.
 *
 * Restoren har bevidst INGEN blur-commit-undertrykkelse. Fokus står ved lukningen i popupen
 * (eller er tabt), ikke i et sagsdatafelt med en åben draft, så der er intet felt at blur'e
 * fra. Popupfelterne er selv transiente. En åben felteditor beskyttes i stedet ved ÅBNINGEN:
 * `ConfirmationDialog` bærer `CONFIRMATION_DIALOG_FOCUS_MARKER`, som felt- og gridfladen læser for
 * at undlade at settle, når fokus flyttes ind i dialogen (`modalFocusTransfer`).
 */
export type UseDialogFocusRestoreOptions<TTrigger extends HTMLElement = HTMLElement> = Readonly<{
  /** Popupens åbne-tilstand. Angives den, kører restoren automatisk ved lukning. */
  open?: boolean;
  /**
   * Ekstern ref til triggeren, når kalderen allerede ejer den. Vinder over hookens egen
   * `triggerRef` og over det huskede aktive element.
   */
  triggerRef?: React.RefObject<TTrigger | null>;
  /**
   * Tillad at falde tilbage til sidens første fokusbare element, hvis triggeren er
   * forsvundet fra DOM'en.
   *
   * Kun for popups, hvis bekræftelse kan fjerne selve triggeren – fx en «Slet»-bekræftelse,
   * der fjerner rækken med sletteknappen. Uden fallback ville fokus lande på `body`. For
   * popups, der ikke kan fjerne deres egen trigger, er fallbacket uønsket: det ville skjule
   * en reel fejl bag et vilkårligt fokusmål.
   */
  allowFirstFocusableFallback?: boolean;
}>;

export type DialogFocusRestore<TTrigger extends HTMLElement = HTMLElement> = Readonly<{
  /**
   * Sæt på den kontrol, der åbner popupen, når popupen selv ejer refen. Ejer kalderen
   * allerede en ref til triggeren, gives den i stedet som `triggerRef`-argument.
   */
  triggerRef: React.RefObject<TTrigger | null>;
  /**
   * Kald fra popupens lukkevej, når lukningen ikke er drevet af en `open`-prop, hooken selv
   * kan observere. Er `open` givet, sker restoren automatisk ved overgangen åben → lukket.
   */
  restoreFocus: () => void;
}>;

const isFocusLost = (): boolean => {
  const activeElement = document.activeElement;
  return activeElement === null
    || activeElement === document.body
    || !activeElement.isConnected
    // Popupens egen container tæller som tabt fokus: den forsvinder ved unmount, og fokus
    // ville da falde til body uden at nogen anden med rette havde overtaget det.
    || activeElement.closest('[role="dialog"], [role="presentation"]') !== null;
};

const isUsableTarget = (element: HTMLElement | null): element is HTMLElement => {
  if (!element?.isConnected) return false;
  if (element.matches(':disabled')) return false;
  return element.closest('[aria-hidden="true"]') === null;
};

/**
 * Sidens første fokusbare element. Bruges kun når triggeren er forsvundet, fordi den
 * bekræftede handling fjernede den (`allowFirstFocusableFallback`).
 */
const findFirstFocusableElement = (): HTMLElement | null => {
  const candidates = document.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]'
  );
  return Array.from(candidates).find((element) => (
    element.isConnected
    && !element.hidden
    && element.tabIndex >= 0
    && element.closest('[aria-hidden="true"]') === null
  )) ?? null;
};

/** Gendan fokus til popupens åbnende kontrol ved lukning. */
export const useDialogFocusRestore = <TTrigger extends HTMLElement = HTMLElement>(
  options: UseDialogFocusRestoreOptions<TTrigger> = {}
): DialogFocusRestore<TTrigger> => {
  const { open, triggerRef: externalTriggerRef, allowFirstFocusableFallback = false } = options;
  const ownTriggerRef = React.useRef<TTrigger>(null);
  const triggerRef = externalTriggerRef ?? ownTriggerRef;
  const activeAtOpenRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  const justClosedRef = React.useRef(false);

  // Husk det aktive element ved åbning som fallback for kontroller uden `triggerRef` – fx en
  // kontrol i en tabelcelle, der ikke kan føre en stabil ref. Læses i layout-effekten, fordi
  // en almindelig effekt først kører efter popupens egen mount-fokus har flyttet `activeElement`.
  React.useLayoutEffect(() => {
    if (open === undefined) return;
    if (open && !wasOpenRef.current) {
      const activeElement = document.activeElement;
      activeAtOpenRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    }
    justClosedRef.current = !open && wasOpenRef.current;
    wasOpenRef.current = open;
  }, [open]);

  const restoreFocus = React.useCallback(() => {
    const restoreTarget = (): void => {
      // Prioritet: (1) den eksplicit udpegede trigger – sand også i browsere, hvor et klik ikke
      // efterlader kontrollen som `activeElement`; (2) det huskede aktive element, som dækker
      // popups uden trigger (fx en PWA-filåbning, der afbryder brugeren midt i et felt);
      // (3) kun med opt-in: sidens første fokusbare element, når triggeren blev slettet.
      if (isUsableTarget(triggerRef.current)) {
        focusElementWithoutScroll(triggerRef.current);
        return;
      }
      if (isUsableTarget(activeAtOpenRef.current)) {
        focusElementWithoutScroll(activeAtOpenRef.current);
        return;
      }
      if (!allowFirstFocusableFallback) return;
      const fallback = findFirstFocusableElement();
      if (fallback) focusElementWithoutScroll(fallback);
    };

    if (!isFocusLost()) return;
    restoreTarget();

    // Se §3 i modulkommentaren: lukningen er ikke ét tidspunkt. Er fokus stadig i behold efter
    // denne frame, gør eftersynet ingenting.
    //
    // Eftersynet er desuden det, der får en trigger UDEN FOR portalen hjem: mens dialogen er åben,
    // ligger resten af appen i MUI's `aria-hidden="true"`-container, så `isUsableTarget` afviser
    // triggeren i første forsøg (bekræftet i chrome-desktop, hvor `Slet alt`-menuknappen lå i et
    // `aria-hidden`-DIV, og fokus derfor blev overladt til MUI og landede på et vilkårligt felt).
    // Attributten er fjernet igen på næste frame, og målet er da brugbart. Derfor må eftersynet ikke
    // gøres betinget af, at FØRSTE forsøg fandt et mål.
    requestAnimationFrame(() => {
      if (isFocusLost()) restoreTarget();
    });
  }, [allowFirstFocusableFallback, triggerRef]);

  React.useEffect(() => {
    if (open === undefined || open || !justClosedRef.current) return undefined;
    justClosedRef.current = false;
    // Gendan på lukningens første frame: WebKit kan flytte fokus til body allerede ved Escape,
    // før en eventuel transition er slut.
    const frame = requestAnimationFrame(restoreFocus);
    return () => cancelAnimationFrame(frame);
  }, [open, restoreFocus]);

  return { triggerRef, restoreFocus };
};

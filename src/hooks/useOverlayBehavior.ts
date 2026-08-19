import React from 'react';
import {
  OVERLAY_ROOT_MARKER,
  isTopmostOverlay,
  popOverlay,
  pushOverlay,
  type OverlayCloseCause,
} from '../components/ui/overlayBehavior';
import { useDialogFocusRestore } from './useDialogFocusRestore';

/**
 * Den fælles adfærd for ETHVERT overlay: lukkeveje, stak-disciplin og fokus-restore.
 *
 * **Hvad hooken ejer**
 *
 *  1. **Escape lukker** – men kun det ØVERSTE overlay, så to lag ikke lukker på ét tryk.
 *  2. **Musens/browserens tilbage-knap lukker** (brugerkrav 2026-08-15). Uden dette navigerede
 *     tilbage-knappen SIDEN væk under et åbent vindue: målt gik `/mineo` → `/mineo/stamdata` med
 *     licensvinduet åbent, så brugeren mistede både vinduet og sin plads.
 *  3. **Fokus-restore ved lukning** – videredelegeret til `useDialogFocusRestore`, som fortsat er den
 *     ene implementering (`keyboard-navigation.md` §Popup-fokus-restore). Hooken erstatter den ikke;
 *     den samler den med resten, så en flade kun har ét sted at hente hele adfærden.
 *
 * **Hvad hooken IKKE ejer:** fokus-FANGSTEN (at Tab bliver inde). Den kommer fra `FocusTrap` for
 * håndrullede overlays og gratis fra MUI `Dialog`. Adskillelsen er bevidst: fangst er en
 * DOM-strukturel ting, restore er en tidslig.
 *
 * **Tilbage-knappen og historikken.** Et åbent overlay skubber ét `history`-trin. Lukkes overlayet ad
 * en anden vej (Escape, X, backdrop), fjernes trinnet igen, så historikken ikke vokser med et dødt
 * trin pr. åbning. Brugerbeslutning 2026-08-15: ét tilbage-tryk lukker ét overlay, og først når der
 * ikke er flere åbne, går tilbage til forrige side.
 */
export type UseOverlayBehaviorOptions<TTrigger extends HTMLElement = HTMLElement> = Readonly<{
  /** Er overlayet åbent? */
  open: boolean;
  /** Kaldes når overlayet skal lukkes. Får årsagen, så en flade kan skelne (fx logge afbrud). */
  /** Returnér `false`, hvis overlayet midlertidigt ikke kan lukkes (fx under en afsendelse). */
  onClose: (cause: OverlayCloseCause) => void | boolean;
  /** Den kontrol, fokus skal tilbage til ved lukning. Se `useDialogFocusRestore` for målprioriteten. */
  triggerRef?: React.RefObject<TTrigger | null>;
  /** Videreført til `useDialogFocusRestore` for popups, hvis handling kan fjerne deres egen trigger. */
  allowFirstFocusableFallback?: boolean;
  /**
   * Slå Escape fra. KUN for flader, hvor Escape allerede har en anden ejer i samme overlay – fx
   * `LoentrinFinderOverlay`, hvis felter selv annullerer deres redigering først (én Escape = én
   * handling). Fladen skal da selv kalde `onClose('escape')`, når intet felt annullerede noget.
   */
  disableEscape?: boolean;
}>;

export type OverlayBehavior<TTrigger extends HTMLElement = HTMLElement> = Readonly<{
  /**
   * Spredes på overlayets ROD-node. Bærer markøren, som `Container` læser for at holde fingrene væk
   * fra Tab – den erstatter den skrøbelige «ligger noden uden for containerens DOM-subtræ?»-udledning.
   */
  overlayRootProps: Readonly<Record<string, string>>;
  triggerRef: React.RefObject<TTrigger | null>;
  /** Kald fra en eksplicit lukkeknap/backdrop, så alle lukkeveje går gennem samme bogføring. */
  requestClose: (cause: OverlayCloseCause) => void;
  /**
   * Videreført fra `useDialogFocusRestore`. Gives til MUI's `onTransitionExited`, hvor portalen
   * unmountes EFTER transitionen. Videreføres frem for at lade fladen kalde hooken en ekstra gang:
   * to kald ville være to restore-veje med hver sin bogføring – præcis det,
   * `keyboard-navigation.md` §Popup-fokus-restore forbyder.
   */
  restoreFocus: () => void;
}>;

/** Historik-tilstanden, et overlay skubber. Læses tilbage i `popstate` for at kende vores eget trin. */
const OVERLAY_HISTORY_FLAG = '__mineoOverlay';

export const useOverlayBehavior = <TTrigger extends HTMLElement = HTMLElement>(
  options: UseOverlayBehaviorOptions<TTrigger>
): OverlayBehavior<TTrigger> => {
  const { open, onClose, triggerRef: externalTriggerRef, allowFirstFocusableFallback, disableEscape } = options;

  const overlayId = React.useId();
  const { triggerRef, restoreFocus } = useDialogFocusRestore<TTrigger>({
    open,
    ...(externalTriggerRef === undefined ? {} : { triggerRef: externalTriggerRef }),
    ...(allowFirstFocusableFallback === undefined ? {} : { allowFirstFocusableFallback }),
  });

  // `onClose` i en ref: lytterne må kun afhænge af `open`, ellers ville en ny inline-callback pr.
  // render af- og gentilmelde dem – og history-trinnet ville blive skubbet igen.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  /** Har VI skubbet et historik-trin, som stadig skal ryddes op? */
  const pushedHistoryRef = React.useRef(false);

  const requestClose = React.useCallback((cause: OverlayCloseCause) => {
    if (cause === 'history-back') {
      // Browseren har allerede forbrugt vores trin. Et travlt overlay kan afvise lukningen; i så fald
      // genskaber vi straks sit eget trin, så et efterfølgende tilbage-tryk ikke navigerer væk fra siden.
      pushedHistoryRef.current = false;
      if (onCloseRef.current(cause) === false) {
        window.history.pushState({ [OVERLAY_HISTORY_FLAG]: overlayId }, '');
        pushedHistoryRef.current = true;
      }
      return;
    }

    // Spørg først fladen. Hvis den afviser, må vi ikke forbruge history-trinnet; ellers ville et
    // travlt overlay blive stående uden sin tilbage-beskyttelse.
    if (onCloseRef.current(cause) === false) return;

    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, [overlayId]);

  // Stak-registrering. Kun det øverste overlay reagerer på Escape og tilbage-knappen.
  React.useEffect(() => {
    if (!open) return undefined;
    pushOverlay(overlayId);
    return () => { popOverlay(overlayId); };
  }, [open, overlayId]);

  // Historik-trinnet, tilbage-knappen skal kunne forbruge.
  React.useEffect(() => {
    if (!open) return undefined;
    window.history.pushState({ [OVERLAY_HISTORY_FLAG]: overlayId }, '');
    pushedHistoryRef.current = true;

    const handlePopState = () => {
      if (!isTopmostOverlay(overlayId)) return;
      requestClose('history-back');
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Lukket ad anden vej: fjern vores trin igen, så historikken ikke samler døde trin.
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        window.history.back();
      }
    };
  }, [open, overlayId, requestClose]);

  // Escape – i BOBLE-fasen med vilje: et felt inde i overlayet, der annullerer sin egen redigering,
  // kalder `stopPropagation()` og standser hændelsen først. Én Escape må ikke både annullere og lukke
  // (`keyboard-navigation.md` §Escape).
  React.useEffect(() => {
    if (!open || disableEscape === true) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!isTopmostOverlay(overlayId)) return;
      event.preventDefault();
      requestClose('escape');
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [disableEscape, open, overlayId, requestClose]);

  const overlayRootProps = React.useMemo(
    () => ({ [OVERLAY_ROOT_MARKER]: 'true' }) as Readonly<Record<string, string>>,
    []
  );

  return { overlayRootProps, triggerRef, requestClose, restoreFocus };
};

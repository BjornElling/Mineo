import React from 'react';
import { Box } from '@mui/material';
import {
  CONTENT_BOX_WIDTH_PX,
  measureNearestContentUiScale,
  resolveSideTabRailWidthPx,
} from '../../utils/uiScale';

/** Scrollportens navngivne markør (`Container`). Skinnen klipper ved dens synlige højrekant. */
const SCROLL_CONTAINER_SELECTOR = '[data-mineo-scroll-container="true"]' as const;

export type SideTabRailProps = {
  readonly children: React.ReactNode;
};

/**
 * Skinnen, kontrolfanerne (`SideTab`) hænger i — og det ene sted, deres udhæng bliver klippet.
 *
 * **Hvorfor den findes.** Fanerne står uden for indholdsboksens højrekant og rager 48 px længere ud
 * end programmets bredeste element. De 48 px er bevidst holdt uden for skaleringens pladsregnskab
 * (`SIDE_TAB_OVERHANG_PX`), fordi en valgfri kontrolflade ikke må kunne skrumpe hele arbejdsfladen.
 * Men et udhæng, der ikke er regnet med, ville uden videre give `Container` vandret rul: en
 * absolut-placeret efterkommer tæller med i scrollportens scrollområde — også når den er roteret.
 * Resultatet var en vandret scrollbar på Erstatningsopgørelse alene, fordi to kontrolfaner var
 * synlige. Skinnen gør udhænget til ren visning: den er præcis så bred som arbejdsfladens SYNLIGE
 * bredde og klipper vandret ved sin egen kant, så alt uden for kanten hverken males eller tælles
 * med i scrollområdet.
 *
 * **Hvorfor bredden måles og ikke regnes ud.** Kanten afhænger af sidemenuens aktuelle bredde
 * (udfoldet/sammenfoldet og menuens egen højdeskala), af gutteren, af arbejdsfladens skala og af den
 * lodrette scrollbars faktiske bredde. Alle fem kan ikke udtrykkes i CSS uden at gætte på mindst én
 * af dem, og et gæt for højt er netop den vandrette scrollbar, skinnen skal forhindre. Målingen
 * læser i stedet scrollportens egen geometri. Beslutningen selv er ren og bor i
 * `resolveSideTabRailWidthPx`.
 *
 * Klipningen er vandret ALENE (`overflow-y: visible`): den roterede fane rager ~265 px NEDAD fra
 * skinnen, og den må ikke beskæres. Skinnen er selv 0 px høj og flytter derfor intet i flowet.
 */
const SideTabRail = React.memo(({ children }: SideTabRailProps) => {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [widthPx, setWidthPx] = React.useState(CONTENT_BOX_WIDTH_PX);

  // Layout-effect og ikke en effect: bredden skal være målt FØR første maling, ellers ses fanerne
  // først fuldt klippet og derefter synlige. Scrollporten findes med `closest` frem for gennem
  // `ScrollContainerContext`, fordi contexten sættes i en effect og altså ikke er der endnu her.
  React.useLayoutEffect(() => {
    const rail = railRef.current;
    const scrollport = rail?.closest<HTMLElement>(SCROLL_CONTAINER_SELECTOR) ?? null;
    if (rail === null || scrollport === null) return;

    const measure = () => {
      const scrollportRect = scrollport.getBoundingClientRect();
      setWidthPx(resolveSideTabRailWidthPx({
        railLeftPx: rail.getBoundingClientRect().left,
        // `clientWidth` udelader den lodrette scrollbar, så kanten er den faktisk synlige.
        scrollportRightPx: scrollportRect.left + scrollport.clientLeft + scrollport.clientWidth,
        scrollLeftPx: scrollport.scrollLeft,
        scale: measureNearestContentUiScale(rail),
      }));
    };

    // Målingen gentages på næste frame, præcis som `PageTabs` gør med faneindikatoren. Grunden er
    // den samme: sidemenuen sætter sin egen skala og dermed sin bredde i sin EGEN layout-effect, og
    // en vinduesændring, der ændrer BÅDE bredde og højde, flytter derfor skinnens venstrekant efter,
    // at vores første måling er kørt. Uden gentagelsen blev skinnen målt mod en kant, der lige skulle
    // flytte sig — målt i WebKit som 8 px for bred, altså en vandret scrollbar.
    let frame: number | null = null;
    const scheduleMeasure = () => {
      measure();
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    scheduleMeasure();
    window.addEventListener('resize', scheduleMeasure);
    // Scrollportens INDHOLDSboks ændrer sig både når vinduet skifter bredde, når sidemenuen foldes
    // ud/sammen, og når den lodrette scrollbar kommer eller går. Alle tre flytter klipperkanten.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(scrollport);
    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Box
      ref={railRef}
      data-mineo-side-tab-rail="true"
      sx={{
        position: 'relative',
        height: 0,
        width: `${widthPx}px`,
        overflowX: 'clip',
        overflowY: 'visible',
      }}
    >
      {children}
    </Box>
  );
});

SideTabRail.displayName = 'SideTabRail';

export default SideTabRail;

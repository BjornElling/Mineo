import type { NavigateFunction } from 'react-router-dom';
import { deserializeFieldAddress, type SectionKey } from '../fieldAddress';
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import { getRouteForPageKey, routeToPageId } from '../../config/pageNavigation';
import { focusElementWithoutScroll, waitForAnimationFrame } from '../../utils/focusUtils';
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import { lookupEditorLocation, type EditorLocationDestination } from './editorLocationDestination';

// Save-blocking focus (§1.4/§3.2). `.eo`-save blokeres KUN af aktivt relevant rejected råinput (§3.9);
// `CaseFileOperations.evaluateSave` returnerer de blokerende `SerializedFieldAddress`'er.
//
// Målet lokaliseres via den FULDE serialiserede feltadresse — samme identitet som undo/redo-restoren bruger
// (`data-mineo-field-address`). Adressen reduceres IKKE til et feltnavn: en nested rækkecelle (fx `belob` i et
// øvrige-krav-rækkeled) ville da miste sin entity-sti og kunne fokusere en vilkårlig anden celle med samme
// feltnavn — eller falde tilbage til "første røde felt på siden". Der findes kun ÉN lokaliseringsvej.
//
// DESTINATIONEN kommer fra editorlokationen, ikke fra adressen (§3.2, R7-F03). Den mounted editor bærer sin egen
// route + fane; findes ingen mounted editor, er sektionens side det eneste, vi VED — og vi gætter da ikke en fane.

/** Maks. antal animation-frames vi venter på, at målet mountes efter et side-/faneskift. */
const MAX_MOUNT_WAIT_FRAMES = 30;

const focusAndScroll = (element: HTMLElement): void => {
  focusElementWithoutScroll(element);
  // Spring til den blokerende fejl: centrér altid, så brugeren ledes direkte til problemet.
  scrollTargetIntoView(element, { force: true });
};

/**
 * Sidste udvej, når INGEN editor for adressen er mountet (fx en fane, brugeren aldrig har besøgt, efter load af
 * en `.eo` med afvist råtekst). Sektionen ejer en side — det er et faktum, ikke en heuristik — og den route er
 * derfor sikker. FANEN udledes bevidst IKKE: kun editorlokationen ved, hvilken fane feltet redigeres på, og et
 * gæt ville være den globale afbildning, R7-F03 lukkede. Vi lander på siden; mounter feltet undervejs (fx fordi
 * det bor på sidens standardfane), fanger vent-på-mount-løkken det og fokuserer det.
 *
 * `faellesAarsloen` har bevidst ingen egen route (den vises under forsørgertab ELLER erhvervsevnetab). Uden en
 * mounted editor findes der intet at vælge ud fra, og vi navigerer da ikke.
 */
const resolveSectionFallbackRoute = (section: SectionKey): string | null => getRouteForPageKey(section);

const applyDestination = (
  destination: EditorLocationDestination,
  currentPathname: string,
  navigate: NavigateFunction
): void => {
  if (destination.tabKey !== null) {
    setActiveTabForPage(routeToPageId(destination.route), destination.tabKey);
  }
  if (destination.route !== currentPathname) navigate(destination.route);
};

/**
 * Fokusér/scroll til det første blokerende rejected felt for et blokeret `.eo`-save.
 *
 * Rækkefølge: (1) er en editor for feltet SYNLIG, bliver vi stående og fokuserer den — Gem hopper aldrig væk fra
 * en fejl brugeren kan se; (2) er en editor mountet men skjult, følger vi DENS erklærede route + fane; (3) er
 * ingen editor mountet, navigerer vi til sektionens side uden at gætte en fane. Kan målet ikke findes, flyttes
 * fokus ikke — gaten viser stadig fejlen.
 */
export const focusFirstBlockingRejectedField = async (
  rejectedAddresses: readonly string[],
  currentPathname: string,
  navigate: NavigateFunction
): Promise<void> => {
  const serialized = rejectedAddresses[0];
  if (serialized === undefined) return;
  const address = deserializeFieldAddress(serialized);
  if (address === null) return;

  await waitForAnimationFrame();

  const lookup = lookupEditorLocation(serialized);

  // (1) Allerede synligt → bliv, og fokusér.
  if (lookup.kind === 'visible') {
    focusAndScroll(lookup.element);
    return;
  }

  // (2) Mountet men skjult → følg lokationens EGEN destination. (3) Ellers → sektionens side, ingen fane.
  if (lookup.kind === 'mounted') {
    applyDestination(lookup.destination, currentPathname, navigate);
  } else {
    const fallbackRoute = resolveSectionFallbackRoute(address.section);
    if (fallbackRoute === null) return;
    if (fallbackRoute !== currentPathname) navigate(fallbackRoute);
  }

  // Blev destinationen udledt af et fallback (3), kender vi endnu ikke feltets fane. Mounter editoren under
  // navigationen (lazy tab-mount), bærer den nu sin erklærede fane, og vi kan aktivere den ÉN gang. Uden dette
  // ville et felt på en ikke-besøgt, ikke-standard fane være uopnåeligt: fanen mountes først ved besøg, og først
  // da findes den lokation, der ved hvilken fane det er.
  let destinationApplied = lookup.kind === 'mounted';

  for (let attempt = 0; attempt < MAX_MOUNT_WAIT_FRAMES; attempt += 1) {
    await waitForAnimationFrame();
    const next = lookupEditorLocation(serialized);
    if (next.kind === 'visible') {
      focusAndScroll(next.element);
      return;
    }
    if (next.kind === 'mounted' && !destinationApplied) {
      destinationApplied = true;
      applyDestination(next.destination, window.location.pathname, navigate);
    }
  }
};

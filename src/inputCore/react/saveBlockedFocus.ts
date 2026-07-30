import type { NavigateFunction } from 'react-router-dom';
import { deserializeFieldAddress, type FieldAddress } from '../fieldAddress';
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import { routeToPageId } from '../../config/pageNavigation';
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
// En synlig/mounted editor er første autoritet for valg mellem spejlinger. Er ingen editor mountet, aktiverer
// det statiske, typed templatelokationskatalog korrekt route/fane, før det konkrete DOM-element kan eksistere.

/** Maks. antal animation-frames vi venter på, at målet mountes efter et side-/faneskift. */
const MAX_MOUNT_WAIT_FRAMES = 30;

const focusAndScroll = (element: HTMLElement): void => {
  focusElementWithoutScroll(element);
  // Spring til den blokerende fejl: centrér altid, så brugeren ledes direkte til problemet.
  scrollTargetIntoView(element, { force: true });
};

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
 * ingen editor mountet, bruger vi feltets statiske templatelokation til at mounte den rigtige fane. Kan målet
 * ikke findes, flyttes fokus ikke — gaten viser stadig fejlen.
 */
export const focusFirstBlockingRejectedField = async (
  rejectedAddresses: readonly string[],
  currentPathname: string,
  navigate: NavigateFunction,
  resolveStaticFieldLocation: (address: FieldAddress) => EditorLocationDestination | undefined
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

  // (2) Mountet men skjult → følg lokationens EGEN destination. (3) Ellers → statisk template-destination.
  if (lookup.kind === 'mounted') {
    applyDestination(lookup.destination, currentPathname, navigate);
  } else {
    const staticDestination = resolveStaticFieldLocation(address);
    if (staticDestination === undefined) return;
    applyDestination(staticDestination, currentPathname, navigate);
  }

  for (let attempt = 0; attempt < MAX_MOUNT_WAIT_FRAMES; attempt += 1) {
    await waitForAnimationFrame();
    const next = lookupEditorLocation(serialized);
    if (next.kind === 'visible') {
      focusAndScroll(next.element);
      return;
    }
  }
};

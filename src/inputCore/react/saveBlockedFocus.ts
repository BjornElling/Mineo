import type { NavigateFunction } from 'react-router-dom';
import { deserializeFieldAddress } from '../fieldAddress';
import { FIELD_ADDRESS_ATTR } from './historyRestoreTarget';
import { isRestoreTargetVisible } from './historyTargetRestoreLoop';
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import { getRouteForPageKey, routeToPageId } from '../../config/pageNavigation';
import { focusElementWithoutScroll, waitForAnimationFrame } from '../../utils/focusUtils';
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import { resolveFieldAddressDestination } from './fieldAddressDestination';

// Greenfield save-blocking focus (§1.4/§3.2). `.eo`-save blokeres KUN af aktivt relevant rejected råinput (§3.9);
// `CaseFileOperations.evaluateSave` returnerer de blokerende `SerializedFieldAddress`'er.
//
// Målet lokaliseres via den FULDE serialiserede feltadresse — samme identitet som undo/redo-restoren bruger
// (`data-mineo-field-address`). Adressen reduceres IKKE til et feltnavn: en nested rækkecelle (fx `belob` i et
// øvrige-krav-rækkeled) ville da miste sin entity-sti og kunne fokusere en vilkårlig anden celle med samme
// feltnavn — eller falde tilbage til "første røde felt på siden". Der findes kun ÉN lokaliseringsvej.

/** Maks. antal animation-frames vi venter på, at målet mountes efter et side-/faneskift. */
const MAX_MOUNT_WAIT_FRAMES = 30;

const findByFieldAddress = (serializedAddress: string): HTMLElement | null => {
  const selector = `[${FIELD_ADDRESS_ATTR}=${JSON.stringify(serializedAddress)}]`;
  for (const element of document.querySelectorAll(selector)) {
    if (element instanceof HTMLElement && isRestoreTargetVisible(element)) return element;
  }
  return null;
};

const focusAndScroll = (element: HTMLElement): void => {
  focusElementWithoutScroll(element);
  // Spring til den blokerende fejl: centrér altid, så brugeren ledes direkte til problemet.
  scrollTargetIntoView(element, { force: true });
};

/**
 * Fokusér/scroll til det første blokerende rejected felt for et blokeret `.eo`-save.
 *
 * Rækkefølge: (1) er målet allerede synligt, bliver vi stående og fokuserer det — Gem hopper aldrig væk fra en
 * fejl brugeren kan se; (2) ellers sættes målets fane og route, og vi venter på, at elementet mountes.
 * Kan målet ikke findes (fx en adresse uden monteret editor), flyttes fokus ikke — gaten viser stadig fejlen.
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

  // Allerede synligt på den aktuelle fane → bliv, og fokusér.
  const visibleNow = findByFieldAddress(serialized);
  if (visibleNow !== null) {
    focusAndScroll(visibleNow);
    return;
  }

  // Ellers: rout til adressens destination (side + fane) og vent på mount.
  const destination = resolveFieldAddressDestination(address, currentPathname);
  if (destination.tabKey !== undefined) {
    const pageRoute = getRouteForPageKey(destination.pageKey);
    if (pageRoute !== null) setActiveTabForPage(routeToPageId(pageRoute), destination.tabKey);
  }
  if (destination.route !== currentPathname) {
    navigate(destination.route);
  }

  for (let attempt = 0; attempt < MAX_MOUNT_WAIT_FRAMES; attempt += 1) {
    await waitForAnimationFrame();
    const target = findByFieldAddress(serialized);
    if (target !== null) {
      focusAndScroll(target);
      return;
    }
  }
};

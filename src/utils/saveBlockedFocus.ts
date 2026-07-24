import type { NavigateFunction } from 'react-router-dom';
import type { StorageKey } from '../config/storageManifest';
import { setActiveTabForPage } from '../hooks/usePersistedActiveTab';
import { focusElementWithoutScroll, waitForAnimationFrame } from './focusUtils';
import { scrollTargetIntoView } from './scrollTargetIntoView';
import { EO_ANGIVET_LOEN_ID } from '../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { APP_ROUTES, getRouteForPageKey, routeToPageId, PAGE_DEFAULT_TAB } from '../config/pageNavigation';
import { resolveTabForCellFieldPath } from '../config/cellInvalidDraftScopes';
import { isEoAfInvalidDraftFieldPath } from '../config/entityInvalidDraftScopes';

// Tabel-input-fejl i EO rapporteres (stadig) som en syntetisk dynamisk felt-fejl med dette suffix
// (se LoenindkomstTab/EOOplysningerTab). Den lever ud over de per-celle `invalidDrafts` og fodrer
// PDF/debug-gaten; den bevares som routing-fallback, men per-celle `invalidDrafts` (med fuldt
// kvalificeret fieldPath + `data-mineo-field-path`) har forrang for præcis scroll-til-celle.
const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

export type BlockingInputErrorTarget = Readonly<{
  kind: 'field';
  pageKey: StorageKey;
  fieldName: string;
  message: string;
}>;

const FOCUSABLE_ERROR_SELECTOR = [
  '.Mui-error input:not([disabled]):not([type="hidden"]):not([type="button"])',
  '.Mui-error textarea:not([disabled])',
  '.Mui-error [role="combobox"][tabindex]:not([aria-disabled="true"])',
  '.Mui-error [aria-haspopup][tabindex]:not([aria-disabled="true"])',
].join(',');

const isVisible = (element: HTMLElement): boolean => {
  if (element.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

const getDescribedByText = (element: HTMLElement): string => {
  const describedBy = element.getAttribute('aria-describedby');
  if (!describedBy) return '';
  return describedBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join('\n');
};

const findFirstVisibleErrorElement = (message?: string): HTMLElement | null => {
  const scrollContainer = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
  const root: ParentNode = scrollContainer ?? document;
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_ERROR_SELECTOR));
  const visibleCandidates = candidates.filter(isVisible);
  if (!message) return visibleCandidates[0] ?? null;

  const exactMatch = visibleCandidates.find((candidate) => getDescribedByText(candidate).trim() === message);
  if (exactMatch) return exactMatch;

  return visibleCandidates.find((candidate) => getDescribedByText(candidate).includes(message)) ?? null;
};

/**
 * Lokalisér det blokerende felt via dets stabile `data-mineo-field-path` (sat på både almindelige
 * felter og grid-celle-inputs). Mere robust end `.Mui-error`-besked-søgning, og virker for grid-celler
 * der ikke bruger MUI's error-styling.
 */
const findVisibleFieldByFieldPath = (fieldPath: string): HTMLElement | null => {
  const scrollContainer = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
  const root: ParentNode = scrollContainer ?? document;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(`[data-mineo-field-path=${JSON.stringify(fieldPath)}]`)
  );
  return candidates.find(isVisible) ?? null;
};

const focusAndScrollToErrorElement = (element: HTMLElement): void => {
  focusElementWithoutScroll(element);
  // Spring til den blokerende fejl: centrér altid, så brugeren ledes direkte til problemet.
  scrollTargetIntoView(element, { force: true });
};

const getRouteForBlockingError = (target: BlockingInputErrorTarget, currentPathname: string): string => {
  // faellesAarsloen er en delt sektion uden egen route; den vises under forsørgertab eller
  // erhvervsevnetab afhængigt af hvor brugeren står. Derfor afgøres route'en af kontekst her.
  if (target.pageKey === 'faellesAarsloen') {
    return currentPathname === APP_ROUTES.forsoergertab ? APP_ROUTES.forsoergertab : APP_ROUTES.erhvervsevnetab;
  }

  return getRouteForPageKey(target.pageKey) ?? currentPathname;
};

const prepareTabForBlockingError = (target: BlockingInputErrorTarget): void => {
  // 1) Per-celle `invalidDrafts`: fieldPath'ens tableId-præfiks bærer mål-fanen (jf. cellInvalidDraftScopes).
  const cellTab = resolveTabForCellFieldPath(target.fieldName);
  if (cellTab !== undefined) {
    const route = getRouteForPageKey(target.pageKey);
    if (route !== null) {
      setActiveTabForPage(routeToPageId(route), cellTab);
    }
    return;
  }

  if (target.pageKey === 'erstatningsopgoerelse') {
    if (isEoAfInvalidDraftFieldPath(target.fieldName)) {
      setActiveTabForPage('erstatningsopgoerelse', 'loenindkomst');
      return;
    }
    // Syntetiske tabel-input-fejl (suffix ':loenindkomst'): "angivet løn"-tabellen hører til
    // EO-oplysninger; alle øvrige (per ansættelsesforhold) hører til lønindkomst-fanen.
    if (target.fieldName.endsWith(EO_LOENINDKOMST_INPUT_ERROR_SUFFIX)) {
      if (target.fieldName === `${EO_ANGIVET_LOEN_ID}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`) {
        setActiveTabForPage('erstatningsopgoerelse', 'eo_oplysninger');
      } else {
        setActiveTabForPage('erstatningsopgoerelse', 'loenindkomst');
      }
      return;
    }
    if (target.fieldName.startsWith('loenindkomstAnsaettelsesforhold')) {
      setActiveTabForPage('erstatningsopgoerelse', 'loenindkomst');
      return;
    }
    if (
      target.fieldName.startsWith('offentligeYdelserRows') ||
      target.fieldName === 'sygedagpengeFra' ||
      target.fieldName === 'sygedagpengeTil'
    ) {
      setActiveTabForPage('erstatningsopgoerelse', 'offentlige_ydelser');
      return;
    }
    setActiveTabForPage('erstatningsopgoerelse', PAGE_DEFAULT_TAB.erstatningsopgoerelse);
    return;
  }

  if (target.pageKey === 'erhvervsevnetab' || target.pageKey === 'faellesAarsloen') {
    setActiveTabForPage('erhvervsevnetab', PAGE_DEFAULT_TAB.erhvervsevnetab);
    return;
  }

  if (target.pageKey === 'renteberegning') {
    setActiveTabForPage('renteberegning', PAGE_DEFAULT_TAB.renteberegning);
    return;
  }

  if (target.pageKey === 'varigemen') {
    setActiveTabForPage('varigemen', PAGE_DEFAULT_TAB.varigemen);
  }
};

// Bemærk (WI-002 greenfield-cutover): den tidligere `getFirstBlockingInputErrorTarget` — der udledte det
// blokerende felt fra den legacy field-error-store med per-issue `blocksSave` — er fjernet. Save-blokering
// afgøres nu strukturelt af rejected råinput (§1.6/§3.9): `CaseFileOperations.evaluateSave` leverer de
// blokerende adresser, og `greenfieldSaveBlockedFocus.blockingTargetFromRejectedAddress` bygger målet. Den
// bevarede DOM-/fane-routing nedenfor (`navigateToBlockingInputError` m.fl.) er fælles for begge veje.

export const focusFirstVisibleBlockingInputError = async (
  target?: BlockingInputErrorTarget | null
): Promise<boolean> => {
  await waitForAnimationFrame();
  if (target) {
    const byPath = findVisibleFieldByFieldPath(target.fieldName);
    if (byPath) {
      focusAndScrollToErrorElement(byPath);
      return true;
    }
  }
  const element = findFirstVisibleErrorElement(target?.message || undefined);
  if (element) {
    focusAndScrollToErrorElement(element);
    return true;
  }

  return false;
};

/**
 * Er der en BLOKERENDE fejl allerede synlig på den fane brugeren står på? I så fald bliver vi
 * på fanen og fokuserer/scroller til den (eller scroller slet ikke, hvis den er i vinduet).
 *
 * "Synlig nu" har forrang frem for den sidekrydsende scanning, så Gem med en synlig fejlbehæftet
 * celle aldrig hopper til en helt anden fane.
 *
 * Et felt-/celle-mål er pr. definition blokerende; hvis dets `data-mineo-field-path` er synligt på
 * den aktuelle fane, bliver vi der. (Almindelige `.Mui-error`-felter med en blokerende besked dækkes
 * af den efterfølgende besked-søgning.)
 */
const focusVisibleBlockingErrorOnCurrentTab = async (
  target: BlockingInputErrorTarget | null
): Promise<boolean> => {
  await waitForAnimationFrame();

  if (target) {
    const byPath = findVisibleFieldByFieldPath(target.fieldName);
    if (byPath) {
      focusAndScrollToErrorElement(byPath);
      return true;
    }
    if (target.message) {
      const element = findFirstVisibleErrorElement(target.message);
      if (element) {
        focusAndScrollToErrorElement(element);
        return true;
      }
    }
  }

  return false;
};

// Maks. antal animation-frame-forsøg på at vente på, at den blokerende celle/felt mountes efter
// et fane-skift (vent-på-mount mod `data-mineo-field-path`). Erstatter den tidligere ubetingede
// faste 30-frame-løkke: hvert forsøg returnerer straks, så snart målet er fundet.
const NAVIGATE_BLOCKING_ERROR_MAX_FRAMES = 30;

export const navigateToBlockingInputError = async (
  target: BlockingInputErrorTarget | null,
  currentPathname: string,
  navigate: NavigateFunction
): Promise<void> => {
  // Forrang: en blokerende fejl der allerede er synlig på den aktuelle fane. Dette undgår at
  // Gem hopper væk fra en fejlbehæftet celle, brugeren allerede kan se.
  if (await focusVisibleBlockingErrorOnCurrentTab(target)) {
    return;
  }

  if (target && await focusFirstVisibleBlockingInputError(target)) {
    return;
  }

  if (!target) return;

  prepareTabForBlockingError(target);
  const route = getRouteForBlockingError(target, currentPathname);
  if (currentPathname !== route) {
    navigate(route);
  }

  // Vent-på-mount: efter fane-/side-skift mountes cellen/feltet typisk først et par frames senere.
  // Hvert forsøg afsluttes straks ved fund (via `data-mineo-field-path`).
  for (let attempt = 0; attempt < NAVIGATE_BLOCKING_ERROR_MAX_FRAMES; attempt += 1) {
    if (await focusFirstVisibleBlockingInputError(target)) {
      return;
    }
  }

  await focusFirstVisibleBlockingInputError();
};

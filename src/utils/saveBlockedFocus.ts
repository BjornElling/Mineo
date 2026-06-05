import type { NavigateFunction } from 'react-router-dom';
import { persistenceSchemas } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';
import { setActiveTabForPage } from '../hooks/usePersistedActiveTab';
import { focusElementWithoutScroll, waitForAnimationFrame } from './commitFlush';
import { getFirstBlockingTableInputErrorTarget, type BlockingTableInputErrorTarget } from './tableInputErrorRegistry';
import { isRecord } from './typeGuards';
import { scrollTargetIntoView } from './scrollTargetIntoView';
import { resolveActiveFieldError, type FieldErrorBySource } from '../types/fieldErrors';
import { EO_ANGIVET_LOEN_ID } from '../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { APP_ROUTES, getRouteForPageKey, PAGE_DEFAULT_TAB } from '../config/pageNavigation';

// Tabel-input-fejl i EO rapporteres som dynamiske felt-fejl med dette suffix (se LoenindkomstTab/
// EOOplysningerTab). De persisterer i field-errors-store og overlever fane-skift, så de skal kunne
// rutes til den rigtige fane uden at elementet er monteret.
const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

export type BlockingFieldErrorTarget = Readonly<{
  kind: 'field';
  pageKey: StorageKey;
  fieldName: string;
  message: string;
}>;

export type BlockingInputErrorTarget = BlockingFieldErrorTarget | BlockingTableInputErrorTarget;

type FieldErrorsSnapshotGetter = (pageKey: StorageKey) => unknown;

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

const focusAndScrollToErrorElement = (element: HTMLElement): void => {
  focusElementWithoutScroll(element);
  // Spring til den blokerende fejl: centrér altid, så brugeren ledes direkte til problemet.
  scrollTargetIntoView(element, { force: true });
};

const getRouteForBlockingError = (target: BlockingInputErrorTarget, currentPathname: string): string => {
  if (target.kind === 'table-input') return currentPathname;

  // faellesAarsloen er en delt sektion uden egen route; den vises under forsørgertab eller
  // erhvervsevnetab afhængigt af hvor brugeren står. Derfor afgøres route'en af kontekst her.
  if (target.pageKey === 'faellesAarsloen') {
    return currentPathname === APP_ROUTES.forsoergertab ? APP_ROUTES.forsoergertab : APP_ROUTES.erhvervsevnetab;
  }

  return getRouteForPageKey(target.pageKey) ?? currentPathname;
};

const prepareTabForBlockingError = (target: BlockingInputErrorTarget): void => {
  if (target.kind === 'table-input') return;

  if (target.pageKey === 'erstatningsopgoerelse') {
    // Dynamiske tabel-input-fejl (suffix ':loenindkomst'): "angivet løn"-tabellen hører til
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

export const getFirstBlockingInputErrorTarget = (
  getErrorsBySourceSnapshot: FieldErrorsSnapshotGetter
): BlockingInputErrorTarget | null => {
  for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
    const errorsBySource = getErrorsBySourceSnapshot(pageKey);
    if (!isRecord(errorsBySource)) continue;

    for (const fieldName of Object.keys(errorsBySource)) {
      const fieldSources = errorsBySource[fieldName];
      if (!isRecord(fieldSources)) continue;

      // Et felt kan have flere samtidige fejl-kilder (input/rule/schema). Kun den AKTIVE fejl
      // (per resolveActiveFieldError) afspejler hvad UI'et faktisk viser. Tidligere returnerede
      // vi den første rå kilde der lignede en blokering — også en overskygget/inaktiv kilde —
      // hvilket kunne sende save til en fane uden synlig fejl. Brug derfor resolveren.
      const active = resolveActiveFieldError(fieldSources as FieldErrorBySource);
      if (active && active.severity === 'error' && active.blocksSave !== false) {
        return { kind: 'field', pageKey, fieldName, message: active.message };
      }
    }
  }

  return getFirstBlockingTableInputErrorTarget();
};

export const focusFirstVisibleBlockingInputError = async (
  target?: BlockingInputErrorTarget | null
): Promise<boolean> => {
  await waitForAnimationFrame();
  if (target?.kind === 'table-input' && target.element?.isConnected) {
    focusAndScrollToErrorElement(target.element);
    return true;
  }
  const element = findFirstVisibleErrorElement(target?.message);
  if (element) {
    focusAndScrollToErrorElement(element);
    return true;
  }

  // Mineos grid-tabel-celler bruger IKKE MUI's `.Mui-error`, så de fanges ikke af
  // FOCUSABLE_ERROR_SELECTOR. Når den blokerende fejl stammer fra en tabelcelle (fx en dynamisk
  // ':loenindkomst'-felt-fejl), genregistrerer cellen sig i tableInputErrorRegistry, så snart dens
  // fane er monteret. Efter fane-skift kan vi derfor finde og scrolle til selve cellen her.
  const tableTarget = getFirstBlockingTableInputErrorTarget();
  if (tableTarget?.element?.isConnected && isVisible(tableTarget.element)) {
    focusAndScrollToErrorElement(tableTarget.element);
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
 * VIGTIGT: Vi må kun short-circuite på elementer der faktisk BLOKERER save — ikke en hvilken som
 * helst `.Mui-error` (UI-fejl på committede værdier har `blocksSave:false` og bærer ofte `.Mui-error`).
 * Pålidelige blokerende signaler på nuværende fane:
 *   1) Tabelcelle-fejl-registret (registreres kun for aktive, blokerende save-fejl mens cellen er monteret).
 *   2) Det sidekrydsende blokerende felt-mål, HVIS dets element tilfældigvis er synligt på denne fane.
 */
const focusVisibleBlockingErrorOnCurrentTab = async (
  target: BlockingInputErrorTarget | null
): Promise<boolean> => {
  await waitForAnimationFrame();

  const tableTarget = getFirstBlockingTableInputErrorTarget();
  if (tableTarget?.element?.isConnected && isVisible(tableTarget.element)) {
    focusAndScrollToErrorElement(tableTarget.element);
    return true;
  }

  // Et felt-mål er pr. definition blokerende; hvis det er synligt på den aktuelle fane, så bliv.
  if (target?.kind === 'field') {
    const element = findFirstVisibleErrorElement(target.message);
    if (element) {
      focusAndScrollToErrorElement(element);
      return true;
    }
  }

  return false;
};

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

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await focusFirstVisibleBlockingInputError(target)) {
      return;
    }
  }

  await focusFirstVisibleBlockingInputError();
};

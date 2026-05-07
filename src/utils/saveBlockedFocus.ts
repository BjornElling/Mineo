import type { NavigateFunction } from 'react-router-dom';
import { persistenceSchemas } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';
import { setActiveTabForPage } from '../hooks/usePersistedActiveTab';
import { focusElementWithoutScroll, waitForAnimationFrame } from './commitFlush';
import { getFirstBlockingTableInputErrorTarget, type BlockingTableInputErrorTarget } from './tableInputErrorRegistry';
import { isRecord } from './typeGuards';

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
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
};

const getRouteForBlockingError = (target: BlockingInputErrorTarget, currentPathname: string): string => {
  if (target.kind === 'table-input') return currentPathname;

  if (target.pageKey === 'faellesAarsloen') {
    if (currentPathname === '/forsoergertab') return '/forsoergertab';
    return '/erhvervsevnetab';
  }

  if (target.pageKey === 'satser') return '/satser';
  return `/${target.pageKey}`;
};

const prepareTabForBlockingError = (target: BlockingInputErrorTarget): void => {
  if (target.kind === 'table-input') return;

  if (target.pageKey === 'erstatningsopgoerelse') {
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
    setActiveTabForPage('erstatningsopgoerelse', 'eo_oplysninger');
    return;
  }

  if (target.pageKey === 'erhvervsevnetab' || target.pageKey === 'faellesAarsloen') {
    setActiveTabForPage('erhvervsevnetab', 'eet-oplysninger');
    return;
  }

  if (target.pageKey === 'renteberegning') {
    setActiveTabForPage('renteberegning', 'calculation');
    return;
  }

  if (target.pageKey === 'varigemen') {
    setActiveTabForPage('varigemen', 'menberegning');
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

      for (const entry of Object.values(fieldSources)) {
        if (
          isRecord(entry) &&
          entry.severity === 'error' &&
          typeof entry.message === 'string' &&
          entry.blocksSave !== false
        ) {
          return { kind: 'field', pageKey, fieldName, message: entry.message };
        }
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
  if (!element) return false;
  focusAndScrollToErrorElement(element);
  return true;
};

export const navigateToBlockingInputError = async (
  target: BlockingInputErrorTarget | null,
  currentPathname: string,
  navigate: NavigateFunction
): Promise<void> => {
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

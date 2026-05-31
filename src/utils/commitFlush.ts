import { getGridCoreForTable } from '../components/tables/gridCore/gridCoreRegistry';

type GridCommitAttemptResult = Readonly<{
  failedCount: number;
  firstFailedElement: HTMLElement | null;
}>;

type SaveCommitFlushResult = Readonly<{
  ok: boolean;
  failedGridCommitCount: number;
}>;

type CriticalActionCommitGuardResult = Readonly<{
  ok: boolean;
  focusTargetBeforeAction: HTMLElement | null;
}>;

const NON_TEXT_EDITING_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color']);

export const waitForAnimationFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export const focusElementWithoutScroll = (element: HTMLElement): void => {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

export const restoreFocusIfPossible = (element: HTMLElement | null): void => {
  if (!element || !element.isConnected) return;
  if (element.matches(':disabled')) return;
  focusElementWithoutScroll(element);
};

export const isOpenTextEditorElement = (element: Element | null): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly;
  }
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }
  if (NON_TEXT_EDITING_INPUT_TYPES.has(element.type)) {
    return false;
  }
  return !element.readOnly;
};

const waitForCommitFlush = async (): Promise<void> => {
  // Beslutningsnote: denne Promise-tick er en infrastruktur-undtagelse fra den normale form-regel.
  // Begrundelse: globale save/load/replace-handlinger skal vente på allerede udløste blur-commits, før vi inspicerer
  // aktive editorer eller fortsætter med kritiske persistence-handlinger.
  // Risiko: at bruge samme mønster inde i almindelige felt-/side-commit-flows ville skjule timing-afhængigheder.
  // Genovervej når: commit flush kan udtrykkes som et eksplicit synkront lifecycle-signal.
  await Promise.resolve();
  // Vent to frames for at lade blur-drevet commit-state og post-render-effekter falde til ro.
  await waitForAnimationFrame();
  await waitForAnimationFrame();
};

export const hasOpenGridEditor = (): boolean => {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table[data-mineo-table-navigation="true"]'));
  for (const table of tables) {
    const core = getGridCoreForTable(table);
    if (core?.getEditingCell()) return true;
  }
  return false;
};

export const commitActiveGridEditors = (): GridCommitAttemptResult => {
  let failedCount = 0;
  let firstFailedElement: HTMLElement | null = null;
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table[data-mineo-table-navigation="true"]'));
  for (const table of tables) {
    const core = getGridCoreForTable(table);
    if (!core) continue;

    const editingCell = core.getEditingCell();
    if (!editingCell) continue;

    const editor = core.getEditor(editingCell);
    if (!editor) {
      continue;
    }
    if (editor.getIsLocked()) {
      failedCount += 1;
      if (firstFailedElement === null) {
        firstFailedElement = editor.getElement();
      }
      continue;
    }

    core.clearFocusPlan();
    const ok = editor.commitCurrent();
    if (!ok) {
      failedCount += 1;
      if (firstFailedElement === null) {
        firstFailedElement = editor.getElement();
      }
    }
  }
  return { failedCount, firstFailedElement };
};

export const commitPendingInputBeforeSave = async (): Promise<SaveCommitFlushResult> => {
  const gridCommitResult = commitActiveGridEditors();
  const failedGridCommitCount = gridCommitResult.failedCount;

  if (failedGridCommitCount > 0) {
    const failedElement = gridCommitResult.firstFailedElement;
    if (failedElement && failedElement.isConnected) {
      focusElementWithoutScroll(failedElement);
    }
    await waitForCommitFlush();
    return {
      ok: false,
      failedGridCommitCount,
    };
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }

  await waitForCommitFlush();

  return {
    ok: failedGridCommitCount === 0,
    failedGridCommitCount,
  };
};

export const prepareForCriticalDataReplacement = async (): Promise<CriticalActionCommitGuardResult> => {
  const focusTargetBeforeAction = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (isOpenTextEditorElement(focusTargetBeforeAction)) {
    return { ok: false, focusTargetBeforeAction };
  }

  const gridCommitResult = commitActiveGridEditors();
  if (gridCommitResult.failedCount > 0) {
    restoreFocusIfPossible(gridCommitResult.firstFailedElement);
    await waitForCommitFlush();
    return { ok: false, focusTargetBeforeAction };
  }

  if (focusTargetBeforeAction) {
    focusTargetBeforeAction.blur();
  }

  await waitForCommitFlush();

  return { ok: true, focusTargetBeforeAction };
};

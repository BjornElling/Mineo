import React from 'react';
import { isOpenTextEditorElement, hasOpenGridEditor } from '../utils/commitFlush';
import { installUndoFocusTracker } from '../utils/undoFocusTracker';
import { useUndoRedo, type UndoRedoNavigate } from './useUndoRedo';

/**
 * Tilkobler den globale undo/redo-adfærd for en app-variant: restore-logikken
 * (`useUndoRedo`), undo-focus-trackeren og tastatur-genvejen
 * (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y).
 *
 * Delt mellem Mineos `MainLayout` og standalone MinProcesrente, så de to apps har
 * præcis samme undo/redo-genvejsadfærd uden duplikeret genvejslogik. Eneste forskel
 * er `navigate`: Mineo injicerer React Routers navigate, standalone en no-op
 * (kun én side, ingen router).
 *
 * Mens en tekst-editor eller grid-celle-editor er åben er genvejen et stille no-op:
 * browserens native tekst-undo stoppes (preventDefault), men Mineos history røres
 * ikke. Jf. `src/contracts/undo-redo-contract.md` §2.
 *
 * Focus-trackeren skal installeres før første commit, så undo-historikken fanger
 * korrekt origin-felt (commit sker typisk på blur efter fokus allerede er flyttet —
 * se `undoFocusTracker.ts`).
 */
export const useUndoRedoShortcuts = (navigate: UndoRedoNavigate) => {
  const controls = useUndoRedo(navigate);
  const { undo, redo } = controls;

  React.useEffect(() => {
    installUndoFocusTracker();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isUndoShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z';
      const isRedoShortcut =
        ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z') || ((e.ctrlKey || e.metaKey) && key === 'y');

      if (!isUndoShortcut && !isRedoShortcut) return;

      // Designvalg: undo/redo er et stille no-op mens en editor er åben (uafsluttet draft
      // i et felt eller en åben grid-celle-editor). Genvejen stoppes, så browserens egen
      // tekst-undo ikke ændrer draften, men Mineos history røres ikke.
      if (isOpenTextEditorElement(document.activeElement) || hasOpenGridEditor()) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      if (isUndoShortcut) {
        undo();
      } else {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  return controls;
};

import * as React from 'react';
import { useInputHistoryAccess } from './inputRuntimeContext';
import { useCriticalInputActions } from './useInputEvaluation';
import type { HistoryOrigin } from '../inputHistory';

// Global undo/redo-genvej (§1.4/§3.6): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y mod den ene
// write-grænses history. Mens en editor er åben er genvejen et stille no-op (§1.4): coordinatorens `prepare`
// returnerer `noop` for undo/redo med åben editor, og vi rører da ikke history. Erstatter legacy
// `useUndoRedoShortcuts` for de øvrige app-varianter (standalone MinProcesrente).
//
// Efter en GENNEMFØRT undo/redo returnerer `runtime.history.undo/redo` et `DispatchInputResult`, hvis
// `.restoredOrigin` er sat, når det gendannede frame bar en origin (§3.7). Shellen leverer `onRestore`, der da
// navigerer til origin-lokationens route/fane og re-fokuserer feltet. En no-op eller fejlende restore surfacer
// ALDRIG en origin (dispatchInput/commitCandidate garanterer det), så `onRestore` kaldes aldrig for en tom restore.

export type UseUndoRedoShortcutsOptions = Readonly<{
  /** Kaldes efter en gennemført undo/redo, hvis det gendannede frame bar en origin. Shellen navigerer/fokuserer. */
  onRestore?: (origin: HistoryOrigin) => void;
}>;

export const useUndoRedoShortcuts = (
  options: UseUndoRedoShortcutsOptions = {}
): void => {
  const history = useInputHistoryAccess();
  const criticalActions = useCriticalInputActions();

  // Hold den seneste onRestore i en ref, så keydown-effekten ikke skal genbindes (og vinduets listener
  // genregistreres), hver gang shellen giver et nyt callback.
  const onRestoreRef = React.useRef(options.onRestore);
  onRestoreRef.current = options.onRestore;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z';
      const isRedo =
        ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z') || ((e.ctrlKey || e.metaKey) && key === 'y');
      if (!isUndo && !isRedo) return;

      e.preventDefault();
      const action = isUndo ? 'undo' : 'redo';
      void criticalActions.prepare(action).then((preparation) => {
        // Åben editor er et stille no-op (§1.4): coordinatoren returnerer `noop`, og history røres ikke.
        if (preparation.status !== 'committed') return;
        const result = isUndo ? history.undo() : history.redo();
        // Kun sat efter en gennemført restore med en origin (§3.7) → naviger/fokusér. Tom/fejlende restore: intet.
        if (result.restoredOrigin !== undefined) {
          onRestoreRef.current?.(result.restoredOrigin);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [criticalActions, history]);
};

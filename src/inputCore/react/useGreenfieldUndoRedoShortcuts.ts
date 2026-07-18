import * as React from 'react';
import { useInputRuntime } from './inputRuntimeContext';
import { useCriticalInputActions } from './useInputEvaluation';

// Greenfield global undo/redo-genvej (§1.4/§3.6): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y mod den ene
// write-grænses history. Mens en editor er åben er genvejen et stille no-op (§1.4): coordinatorens `prepare`
// returnerer `noop` for undo/redo med åben editor, og vi rører da ikke history. Erstatter legacy
// `useUndoRedoShortcuts` for de greenfield-migrerede app-varianter (standalone MinProcesrente).
//
// Bemærk: dette er en genvejs-wiring på shell-niveau. Fuld undo/redo-FOKUSNAVIGATION (spring til origin-feltet)
// færdiggøres sammen med shell-cutoveren; her gendannes history-tilstanden korrekt, men der navigeres ikke.

export const useGreenfieldUndoRedoShortcuts = (): void => {
  const runtime = useInputRuntime();
  const criticalActions = useCriticalInputActions();

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
        if (isUndo) runtime.history.undo();
        else runtime.history.redo();
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [criticalActions, runtime.history]);
};

import * as React from 'react';
import { useInputEditPort, useInputHistoryAccess } from './inputRuntimeContext';
import { useCriticalInputActions } from './useInputEvaluation';
import { hasOpenOverlay } from '../../components/ui/overlayBehavior';
import type { HistoryOrigin } from '../inputHistory';

// Global undo/redo-genvej (§1.4/§3.6): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y mod den ene
// write-grænses history. Mens en editor er åben er genvejen et stille no-op (§1.4): coordinatorens `prepare`
// returnerer `noop`, og history røres ikke.
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
  // Synkron aflæsning af «er en felteditor åben lige nu?». Se begrundelsen i keydown-handleren.
  const { registry } = useInputEditPort();

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

      // Så længe et overlay er åbent, ejer overlayet tastaturet (`keyboard-navigation.md`
      // §Overlay-adfærd). Lytteren sidder på `window` og ramte derfor uanset hvad der lå ovenpå:
      // et Ctrl+Z bag en åben «Slet alt»-bekræftelse ryddede feltet BAG dialogen, mens dialogen
      // blev stående og spurgte uændret om noget andet. Brugeren svarede altså på et spørgsmål om
      // en sag, der ikke længere var den, han kiggede på – og fortrydelsens egen markering af
      // feltet foregik bag dialogen, hvor den ikke kunne ses.
      //
      // Ingen `preventDefault()` her: tasten er ikke vores, mens overlayet ejer den.
      if (hasOpenOverlay()) return;

      // Er en felteditor åben, rører programmets fortrydelse IKKE history (§1.4) – det er en truffen
      // beslutning: Ctrl+Z har præcis ÉN funktion, at føre den seneste AFSLUTTEDE feltændring tilbage,
      // og må ikke også kunne ændre tegn i et åbent felt. Men så skal tasten heller ikke SPÆRRES:
      // `preventDefault()` lå her ubetinget, så browserens egen tekstfortrydelse blev slået ihjel
      // samtidig. Brugeren stod dermed med et felt fuldt af tekst og en tast, der hverken gjorde det
      // ene eller det andet – en tast, der spærres uden at bruges, er et sort hul.
      //
      // Prøven skal være SYNKRON. `prepare()` er asynkron, og når dens `noop` foreligger, er
      // keydown-hændelsen længe returneret, og `preventDefault()` kan ikke længere undlades. Derfor
      // læses den åbne editor direkte af registret her; `prepare` er fortsat den autoritative
      // beslutning om history og bevarer sin egen `noop`-vej nedenfor.
      if (registry.getEditing() !== null) return;

      e.preventDefault();
      const action = isUndo ? 'undo' : 'redo';
      void criticalActions.prepare(action).then((preparation) => {
        // Åben editor er et stille no-op (§1.4): coordinatoren returnerer `noop`, og history røres ikke.
        // Vejen er stadig nået, hvis en editor åbnes i vinduet mellem prøven ovenfor og dette svar.
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
  }, [criticalActions, history, registry]);
};

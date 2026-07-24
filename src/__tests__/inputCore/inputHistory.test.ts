import {
  createInputHistory,
  pushInputHistory,
  undoInputHistory,
  redoInputHistory,
  type HistoryOrigin,
} from '../../inputCore/inputHistory';
import { createEmptySettledInput, type SettledInput } from '../../inputCore';
import type { FieldAddress } from '../../inputCore/fieldAddress';

// WI-003: history bevarer struktur-origin (§3.7) symmetrisk gennem undo → redo, så undo/redo-restoren kan
// navigere til den rette route/fane og fokusere feltet, ændringen kom fra. Ren datastruktur-test uden runtime.

const address: FieldAddress = { section: 'satser', path: [], field: 'aargang' };

const origin: HistoryOrigin = {
  field: address,
  editorLocationId: 'satser:aargang',
  route: '/satser',
  tabKey: null,
};

// To distinkte afsluttede input-værdier at bevæge historyen imellem (indholdet er irrelevant for origin-bevaring).
const inputA: SettledInput = createEmptySettledInput();
const inputB: SettledInput = createEmptySettledInput();

describe('inputHistory — origin-bevaring (§3.7)', () => {
  it('bevarer originen symmetrisk gennem undo → redo', () => {
    // Push et før-snapshot (inputA) MED origin; current er nu inputB.
    const history = pushInputHistory(createInputHistory(), inputA, origin);

    const undo = undoInputHistory(history, inputB);
    expect(undo.changed).toBe(true);
    if (!undo.changed) throw new Error('undo skulle ændre');
    // Undo-target bærer originen (så shellen kan navigere til origin-lokationen).
    expect(undo.target.origin).toEqual(origin);
    // Det gemte current-frame i future bærer SAMME origin, så en efterfølgende redo lander samme sted.
    expect(undo.history.future[0]?.origin).toEqual(origin);

    const redo = redoInputHistory(undo.history, inputA);
    expect(redo.changed).toBe(true);
    if (!redo.changed) throw new Error('redo skulle ændre');
    expect(redo.target.origin).toEqual(origin);
  });

  it('et frame uden origin bevarer fraværet af origin gennem undo → redo', () => {
    const history = pushInputHistory(createInputHistory(), inputA);

    const undo = undoInputHistory(history, inputB);
    if (!undo.changed) throw new Error('undo skulle ændre');
    expect(undo.target.origin).toBeUndefined();
    expect(undo.history.future[0]?.origin).toBeUndefined();

    const redo = redoInputHistory(undo.history, inputA);
    if (!redo.changed) throw new Error('redo skulle ændre');
    expect(redo.target.origin).toBeUndefined();
  });
});

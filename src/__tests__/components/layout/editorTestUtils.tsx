import React from 'react';
import { activeEditorRegistry, type ActiveEditor } from '../../../inputCore/runtime/activeEditorRegistry';

// Delt shell-testlim. En "åben editor" registreres direkte i `activeEditorRegistry`, som
// coordinatoren læser (§1.4). En editor, hvis `settle()` KASTER, giver et fail-closed
// `blocked` for settle-handlinger (save/navigate); undo/redo bliver et stille `noop`, mens en editor er åben.

/**
 * Monterer en åben greenfield-editor. `settle()` kaster (uventet settle-fejl → fail-closed `blocked`, §1.4), og
 * `getFocusTarget` peger på et fokuserbart input, så shellens fail-closed-feedback kan fokusere det. Editoren
 * afmeldes ved unmount, så registrets højst-én-aktiv-invariant (§3.5) aldrig brydes mellem tests.
 */
export const OpenEditor = ({ label }: { label: string }): React.ReactElement => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const editor: ActiveEditor = {
      id: `test-open-editor:${label}`,
      isEditing: () => true,
      settle: () => {
        throw new Error('Simuleret uventet settle-fejl fra åben testeditor');
      },
      discard: () => {},
      getFocusTarget: () => ({
        focus: () => inputRef.current?.focus({ preventScroll: true }),
      }),
    };
    const unregister = activeEditorRegistry.register(editor);
    return unregister;
  }, [label]);
  return <input ref={inputRef} aria-label={label} />;
};

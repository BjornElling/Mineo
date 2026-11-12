// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';

type Captured = {
  hasUnsavedChanges: boolean | null;
  markSaved: ((revision: number) => void) | null;
};

const createCapture = (hasChangedOpenDraft: () => boolean = () => false) => {
  const captured: Captured = { hasUnsavedChanges: null, markSaved: null };
  const Capture = ({ revision, epoch }: { revision: number; epoch: number }) => {
    const guard = useUnsavedChangesGuard({
      combinedSectionRevision: revision,
      authoritativeSnapshotEpoch: epoch,
      hasChangedOpenDraft,
    });
    captured.hasUnsavedChanges = guard.hasUnsavedChanges;
    captured.markSaved = guard.markSaved;
    return null;
  };
  return { captured, Capture };
};

/** Afgør, om browseren ville spørge, før siden forlades. */
const exitIsGuarded = (): boolean => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('beregner hasUnsavedChanges ud fra committed revision og gemt baseline', () => {
    const { captured, Capture } = createCapture();

    const rendered = render(<Capture revision={1} epoch={1} />);
    expect(captured.hasUnsavedChanges).toBe(false);

    rendered.rerender(<Capture revision={2} epoch={1} />);
    expect(captured.hasUnsavedChanges).toBe(true);

    act(() => {
      captured.markSaved?.(2);
    });
    expect(captured.hasUnsavedChanges).toBe(false);

    rendered.rerender(<Capture revision={5} epoch={2} />);
    expect(captured.hasUnsavedChanges).toBe(false);
  });

  it('bevarer markeringen af ugemt arbejde gennem en genindlæsning (BB-394/BB-395)', () => {
    const first = createCapture();
    const beforeReload = render(<first.Capture revision={1} epoch={1} />);
    beforeReload.rerender(<first.Capture revision={2} epoch={1} />);
    expect(exitIsGuarded()).toBe(true);
    beforeReload.unmount();

    // F5: input hydreres til en ny revision og en ny mount-baseline. Markeringen skal følge med.
    const second = createCapture();
    const afterReload = render(<second.Capture revision={1} epoch={1} />);
    expect(second.captured.hasUnsavedChanges).toBe(true);
    expect(exitIsGuarded()).toBe(true);

    // Et vellykket gem/download fjerner markeringen igen.
    act(() => {
      second.captured.markSaved?.(1);
    });
    expect(second.captured.hasUnsavedChanges).toBe(false);
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.unsavedWork)).toBeNull();
    expect(exitIsGuarded()).toBe(false);
    afterReload.unmount();
  });

  it('nulstiller den bårne markering ved en autoritativ erstatning efter mount (Hent/Slet alt)', () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.unsavedWork, '1');
    const { captured, Capture } = createCapture();
    const rendered = render(<Capture revision={3} epoch={1} />);
    expect(captured.hasUnsavedChanges).toBe(true);

    rendered.rerender(<Capture revision={4} epoch={2} />);
    expect(captured.hasUnsavedChanges).toBe(false);
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.unsavedWork)).toBeNull();
    rendered.unmount();
  });

  it('beskytter en faktisk ændret, åben indtastning uden afsluttede ændringer (BB-396)', () => {
    let openDraftChanged = false;
    const { Capture } = createCapture(() => openDraftChanged);
    const rendered = render(<Capture revision={1} epoch={1} />);
    expect(exitIsGuarded()).toBe(false);

    openDraftChanged = true;
    expect(exitIsGuarded()).toBe(true);

    openDraftChanged = false;
    expect(exitIsGuarded()).toBe(false);
    rendered.unmount();
  });
});
